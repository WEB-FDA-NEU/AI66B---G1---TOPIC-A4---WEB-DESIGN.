"""Schema tests independent of PostgreSQL; every payment needs validated buyer input."""
import importlib.util
from pathlib import Path
import sys
import unittest
from uuid import uuid4

from pydantic import ValidationError

SCHEMA = Path(__file__).resolve().parents[1] / 'backend/app/schemas.py'
spec = importlib.util.spec_from_file_location('concertly_checkout_schema', SCHEMA)
schemas = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = schemas
spec.loader.exec_module(schemas)


class CheckoutContractTests(unittest.TestCase):
    def buyer(self, **changes):
        return dict(full_name='Test Buyer', email='buyer@example.com', phone='+84 912 345 678') | changes

    def checkout(self, **changes):
        return schemas.CheckoutRequest(reservation_id=uuid4(), payment_method='card', **({'buyer': self.buyer()} | changes))

    def test_missing_buyer_is_rejected(self):
        with self.assertRaises(ValidationError):
            schemas.CheckoutRequest(reservation_id=uuid4(), payment_method='card')
        with self.assertRaises(ValidationError):
            self.checkout(buyer=None)

    def test_valid_buyer_and_whitespace_normalization(self):
        buyer = self.checkout(buyer=self.buyer(full_name='  Test Buyer  ')).buyer
        self.assertEqual(buyer.full_name, 'Test Buyer')
        self.assertEqual(buyer.phone, '+84 912 345 678')

    def test_invalid_contact_is_rejected(self):
        for changes in [dict(full_name=' '), dict(full_name='x' * 151), dict(email='bad'),
                        dict(email='a@b'), dict(phone='1234567'), dict(phone='1' * 16),
                        dict(phone='abc12345678'), dict(phone='++84912345678')]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                self.checkout(buyer=self.buyer(**changes))

    def test_partial_buyer_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.checkout(buyer={'full_name': 'Buyer'})

    def test_eight_seat_boundary(self):
        self.assertEqual(len(schemas.HoldRequest(concert_id=1, seat_ids=list(range(1, 9))).seat_ids), 8)
        for ids in [[], list(range(1, 10))]:
            with self.subTest(ids=ids), self.assertRaises(ValidationError):
                schemas.HoldRequest(concert_id=1, seat_ids=ids)


if __name__ == '__main__':
    unittest.main()
