# Testing Review Report

## Review Results

The system was reviewed and tested using the Admin account. The following functions worked as expected during the review:

- Admin registration and login
- Searching for concerts and viewing concert details
- Selecting tickets, holding seats, and checkout
- Viewing tickets and orders, and cancelling orders
- Seat-hold expiration
- Admin concert CRUD operations
- Dashboard and check-in

## Issue Found

Regular users are currently unable to log in to the system. This issue was not observed when testing with the Admin account.

## Conclusion

The tested requirements worked as expected when using the Admin account. However, regular user login is not working and must be investigated before the user-side flows can be considered fully verified.

## Next Steps

- Assign the regular user login issue to the responsible team member.
- Investigate and fix regular user authentication.
- Retest login with a regular user account.
- Retest the main user flows after the fix.
- Update this report with the retest results.
