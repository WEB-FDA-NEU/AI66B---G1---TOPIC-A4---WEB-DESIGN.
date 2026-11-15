# Test Cases – Concert Ticket Booking Website

**Test result summary:** 38 PASS, 2 FAIL

## 1. Authentication (6 test cases)

| ID | Test description | Input / Test data | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| **AUTH-001** | **Login with a regular User account** | **Valid User email and password** | **User logs in successfully and is redirected to the user page.** | **Login fails, while the Admin account can log in successfully.** | **FAIL** |
| AUTH-002 | Login with an Admin account | Valid Admin email and password | Admin logs in and can access the Admin dashboard. | Admin login succeeds. | PASS |
| AUTH-003 | Login with an incorrect password | Valid email and incorrect password | System rejects login and displays an error message. | Login is rejected. | PASS |
| AUTH-004 | Login with an invalid email format | Invalid email format and password | System validates the email format and does not log in. | Invalid email is rejected. | PASS |
| AUTH-005 | Login with empty fields | Empty email and password | System asks the user to fill in required fields. | Required-field validation works. | PASS |
| AUTH-006 | Access a protected page with an expired token | Expired authentication token | System rejects the expired token and requires login again. | Expired token is rejected. | PASS |

## 2. Concerts (6 test cases)

| ID | Test description | Input / Test data | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| CON-001 | View the concert list | Open the concert listing page | Available concerts are displayed. | Concert list is displayed. | PASS |
| CON-002 | View concert details | Select an available concert | Correct concert information is displayed. | Concert details are displayed. | PASS |
| CON-003 | Search for a concert | Enter a concert name | Matching concerts are displayed. | Search returns matching results. | PASS |
| CON-004 | Filter concerts | Select an available filter | Concert list updates according to the selected filter. | Filter works as expected. | PASS |
| CON-005 | Open a concert that does not exist | Use an invalid concert ID | System displays a not-found message or page. | Not-found response is displayed. | PASS |
| CON-006 | View concerts when no results are available | Search for a name with no match | System displays an empty-state message. | Empty-state message is displayed. | PASS |

## 3. Seat Holding and Payment (12 test cases)

| ID | Test description | Input / Test data | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| BOOK-001 | View available seats | Open seat selection for a concert | Available seats are shown as selectable. | Available seats are displayed. | PASS |
| BOOK-002 | Select an available seat | Select one available seat | Selected seat is marked as selected. | Seat is selected successfully. | PASS |
| BOOK-003 | Hold a selected seat | Select a seat and confirm hold | Seat is held for the configured time. | Seat is held successfully. | PASS |
| BOOK-004 | Check reservation countdown | Hold a seat and observe countdown | Countdown displays the remaining hold time. | Countdown is displayed. | PASS |
| BOOK-005 | Try to hold a sold seat | Select a seat that is already sold | System prevents the seat from being held. | Sold seat cannot be held. | PASS |
| BOOK-006 | Try to hold a seat held by another user | User B selects a seat currently held by User A | System prevents User B from holding the same seat. | Duplicate hold is prevented. | PASS |
| BOOK-007 | Complete mock payment | Confirm payment for a valid reservation | Payment flow completes and booking is confirmed. | Mock payment completes. | PASS |
| BOOK-008 | Cancel or fail mock payment | Exit or fail the payment flow | Booking is not incorrectly marked as paid. | Booking remains unpaid. | PASS |
| BOOK-009 | Pay after reservation expires | Attempt payment after the hold expires | System rejects payment for the expired reservation. | Expired reservation cannot be paid. | PASS |
| BOOK-010 | Refresh during seat reservation | Refresh the page while a seat is held | System displays the correct reservation state. | Reservation state is retained correctly. | PASS |
| BOOK-011 | Check booking confirmation | Complete a successful booking | Confirmation details are displayed. | Booking confirmation is displayed. | PASS |
| BOOK-012 | Check ticket QR code | Open the ticket after successful payment | Ticket QR code is displayed. | QR code is displayed. | PASS |

## 4. Cancellation and Refund (6 test cases)

| ID | Test description | Input / Test data | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| REF-001 | Cancel a valid booking | Select a booking eligible for cancellation | Booking is cancelled successfully. | Booking is cancelled. | PASS |
| REF-002 | View a cancelled booking | Open booking history after cancellation | Booking status is shown as cancelled. | Cancelled status is displayed. | PASS |
| REF-003 | Cancel an already-cancelled booking | Select a booking that is already cancelled | System prevents a second cancellation. | Second cancellation is rejected. | PASS |
| REF-004 | Request refund for an eligible cancelled booking | Submit a refund request | System records the refund request or displays its status. | Refund request is recorded. | PASS |
| REF-005 | Request refund for an invalid booking | Submit a refund request for an ineligible booking | System rejects the request. | Invalid refund request is rejected. | PASS |
| REF-006 | Check refund status | Open refund details | Current refund status is displayed. | Refund status is displayed. | PASS |

## 5. Admin and Authorization (10 test cases)

| ID | Test description | Input / Test data | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| ADMIN-001 | Open Admin dashboard as Admin | Log in with Admin account | Admin dashboard is accessible. | Admin dashboard opens. | PASS |
| ADMIN-002 | Open Admin page as regular User | Log in as User and access Admin page | Access is denied. | User cannot access Admin page. | PASS |
| ADMIN-003 | Call Admin API as regular User | Use a User token to call an Admin API | API rejects the unauthorized request. | Unauthorized request is rejected. | PASS |
| ADMIN-004 | View dashboard information | Open Admin dashboard | Dashboard information is displayed. | Dashboard information is displayed. | PASS |
| ADMIN-005 | Create a concert as Admin | Submit valid concert information | New concert is created. | Concert is created. | PASS |
| ADMIN-006 | Update concert information | Edit an existing concert | Updated information is saved and displayed. | Concert information is updated. | PASS |
| ADMIN-007 | Delete a concert | Delete an existing concert | Concert is deleted or marked unavailable. | Concert is deleted. | PASS |
| ADMIN-008 | View booking list as Admin | Open booking management | Booking records are displayed. | Booking list is displayed. | PASS |
| **ADMIN-009** | **Open Support page as Admin** | **Log in as Admin and select Support page** | **Support page loads successfully.** | **Support page returns 404 Not Found.** | **FAIL** |
| ADMIN-010 | Check in a ticket twice | Scan the same ticket QR code twice | First check-in succeeds; duplicate check-in is rejected. | Duplicate check-in is rejected. | PASS |

## 6. Failed Test Cases – Issues to Fix

| Bug ID | Related test case | Issue | Actual result |
|---|---|---|---|
| BUG-001 | AUTH-001 | Regular User cannot log in | User login fails, although Admin login works. |
| BUG-002 | ADMIN-009 | Admin Support page is unavailable | Support page returns 404 Not Found. |

## 7. Test Summary

| Result | Number of test cases |
|---|---:|
| PASS | 38 |
| FAIL | 2 |
| Total | 40 |

**Conclusion:** 38 test cases passed and 2 test cases failed. The regular User login issue and Admin Support page 404 issue need to be investigated and fixed.
