"""Read-only source checks + JS behavior tests. Uses Node or macOS JavaScriptCore."""
import ast
import ctypes
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


class JavaScriptCore:
    def __init__(self):
        self.lib = ctypes.CDLL('/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore')
        ptr = ctypes.c_void_p
        specs = {
            'JSGlobalContextCreate': ([ptr], ptr),
            'JSGlobalContextRelease': ([ptr], None),
            'JSStringCreateWithUTF8CString': ([ctypes.c_char_p], ptr),
            'JSStringRelease': ([ptr], None),
            'JSCheckScriptSyntax': ([ptr, ptr, ptr, ctypes.c_int, ctypes.POINTER(ptr)], ctypes.c_bool),
            'JSEvaluateScript': ([ptr, ptr, ptr, ptr, ctypes.c_int, ctypes.POINTER(ptr)], ptr),
            'JSValueToStringCopy': ([ptr, ptr, ctypes.POINTER(ptr)], ptr),
            'JSStringGetMaximumUTF8CStringSize': ([ptr], ctypes.c_size_t),
            'JSStringGetUTF8CString': ([ptr, ctypes.c_char_p, ctypes.c_size_t], ctypes.c_size_t),
        }
        for name, (args, result) in specs.items():
            func = getattr(self.lib, name)
            func.argtypes, func.restype = args, result
        self.context = self.lib.JSGlobalContextCreate(None)

    def string(self, value):
        result = self.lib.JSValueToStringCopy(self.context, value, None)
        size = self.lib.JSStringGetMaximumUTF8CStringSize(result)
        buffer = ctypes.create_string_buffer(size)
        self.lib.JSStringGetUTF8CString(result, buffer, size)
        self.lib.JSStringRelease(result)
        return buffer.value.decode()

    def execute(self, source, syntax=False):
        text = self.lib.JSStringCreateWithUTF8CString(source.encode())
        error = ctypes.c_void_p()
        if syntax:
            value = self.lib.JSCheckScriptSyntax(self.context, text, None, 1, ctypes.byref(error))
        else:
            value = self.lib.JSEvaluateScript(self.context, text, None, None, 1, ctypes.byref(error))
        self.lib.JSStringRelease(text)
        if error.value:
            raise AssertionError(self.string(error.value))
        return value if syntax else self.string(value)


class PageParser(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.ids, self.scripts = path, set(), []
        self.in_script = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'{self.path}: duplicate id {attrs["id"]}'
            self.ids.add(attrs['id'])
        if tag == 'script' and 'src' not in attrs:
            self.in_script = True
            self.scripts.append('')
        for attr in (['src'] if tag in ('script', 'img') else ['href'] if tag == 'link' else []):
            value = attrs.get(attr, '')
            if value and not re.match(r'^(?:[a-z]+:|//|#)', value):
                assert (self.path.parent / value.split('?')[0]).exists(), f'{self.path}: missing {value}'

    def handle_data(self, data):
        if self.in_script:
            self.scripts[-1] += data

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False


def main():
    for path in [*(ROOT / 'backend').rglob('*.py'), *(ROOT / 'tests').glob('*.py')]:
        if not any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            ast.parse(path.read_text(), filename=str(path))
    scripts = [(str(path.relative_to(ROOT)), path.read_text()) for path in (ROOT / 'js').rglob('*.js')]
    for page in [ROOT / 'index.html', *(ROOT / 'pages').rglob('*.html')]:
        parser = PageParser(page)
        parser.feed(page.read_text())
        scripts.extend((f'{page.name}:inline:{n}', source) for n, source in enumerate(parser.scripts))
    for path in (ROOT / 'css').glob('*.css'):
        css = re.sub(r'/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '', path.read_text(), flags=re.S)
        depth = 0
        for char in css:
            depth += (char == '{') - (char == '}')
            assert depth >= 0, f'{path}: unexpected closing brace'
        assert depth == 0, f'{path}: unbalanced CSS rules'
    node = shutil.which('node')
    if node:
        for name, source in scripts:
            result = subprocess.run([node, '--check'], input=source, text=True, capture_output=True)
            assert result.returncode == 0, f'{name}: {result.stderr}'
        subprocess.run([node, str(ROOT / 'tests/frontend.test.js')], cwd=ROOT, check=True)
    elif sys.platform == 'darwin':
        runtime = JavaScriptCore()
        for name, source in scripts:
            try:
                runtime.execute(source, syntax=True)
            except AssertionError as error:
                raise AssertionError(f'{name}: {error}') from error
        sources = {name: (ROOT / f'js/{name}.js').read_text() for name in ['components', 'checkout', 'purchases', 'tickets', 'venue-engine']}
        runtime.execute(f'globalThis.__sources = {json.dumps(sources)};')
        runtime.execute((ROOT / 'tests/frontend.test.js').read_text())
        result = runtime.execute('JSON.stringify(globalThis.__testResults || null)')
        assert result != 'null', 'Asynchronous JS tests did not complete'
        results = json.loads(result)
        for item in results:
            print(f'{"PASS" if item["passed"] else "FAIL"} {item["name"]}')
            if not item['passed']:
                print(item['error'])
        assert all(item['passed'] for item in results), 'JS behavior test failed'
        runtime.lib.JSGlobalContextRelease(runtime.context)
    else:
        raise RuntimeError('Install Node to run JavaScript checks on this platform.')
    print(f'PASS Python syntax, HTML resource/id checks, CSS brace checks, {len(scripts)} JS files/inline blocks')


if __name__ == '__main__':
    main()
