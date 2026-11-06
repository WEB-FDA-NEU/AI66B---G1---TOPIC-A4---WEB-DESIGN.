class DomainError(Exception):
    """Business-rule failure that maps directly onto an HTTP response."""

    def __init__(self, status_code: int, code: str, message: str, **details):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def not_found(message: str = "Not found") -> DomainError:
    return DomainError(404, "not_found", message)


def forbidden(message: str = "Forbidden") -> DomainError:
    return DomainError(403, "forbidden", message)


def conflict(code: str, message: str, **details) -> DomainError:
    return DomainError(409, code, message, **details)


def bad_request(code: str, message: str, **details) -> DomainError:
    return DomainError(400, code, message, **details)
