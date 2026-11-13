# Test Plan

## 1. Purpose

This document explains how the team will test the CONCERTLY website. The goal is to check that the main features work correctly and that users can complete the ticket-booking process without errors.

## 2. Testing Scope

### Backend Testing
- Test user registration and login.
- Test concert information and seat availability.
- Test seat reservation and seat-holding time.
- Test mock payment and order creation.
- Test ticket generation and QR codes.
- Test check-in and admin permissions.

### Frontend Testing
- Check that all pages display correctly.
- Test buttons, forms, navigation, and input fields.
- Check seat selection and countdown timer.
- Check error messages and success notifications.
- Test the website on different browsers and screen sizes.

### Integration Testing
- Check whether the frontend communicates correctly with the backend.
- Test the complete booking process, from login to receiving a ticket.
- Check whether booking information is saved in the database.
- Test whether two users can book tickets at the same time without receiving the same seat.
- Check whether the ticket remains available after refreshing the page or logging in again.

## 3. Test Environments

The team will use two environments:

**Local Environment**
- Run the backend and frontend on a local computer.
- Use a separate test database.
- Use test accounts and sample concert data.
- Check basic functions before testing on Render.

**Render Environment**
- Test the deployed website and backend.
- Use the Render database and test accounts.
- Check whether the deployed system works correctly.
- Use two browsers or devices to test simultaneous bookings.

**Important:** Do not run destructive tests on the production database. Do not share passwords, database URLs, or secret keys in GitHub Issues.

## 4. Test Accounts and Data

Prepare the following test accounts:

| Account | Purpose |
|---|---|
| Customer A | Test normal ticket booking |
| Customer B | Test simultaneous booking |
| Staff | Test ticket check-in |
| Admin | Test admin functions and permissions |

Prepare sample data:
- At least one concert.
- Several available seats.
- One or more test orders.
- Test tickets with QR codes.
- Different account roles.

The team should confirm that the test accounts and data are ready before testing.

## 5. Main Testing Flows

### Flow 1: User Authentication
1. Register a new account.
2. Log in with valid information.
3. Try logging in with incorrect information.
4. Log out and log in again.
5. Check whether the account information is displayed correctly.

### Flow 2: Concert and Seat Selection
1. Open the concert page.
2. Select a concert.
3. View available seats.
4. Select a seat.
5. Check whether the selected seat is held correctly.
6. Check whether the countdown timer works.

### Flow 3: Booking and Payment
1. Log in as Customer A.
2. Select an available seat.
3. Continue to checkout.
4. Complete the mock payment.
5. Check whether the order is created.
6. Check whether the ticket and QR code are generated.

### Flow 4: Simultaneous Booking
1. Open the website in two browsers.
2. Log in as Customer A and Customer B.
3. Open the same concert.
4. Try selecting the same seat at nearly the same time.
5. Check whether the system prevents both users from booking the same seat.

### Flow 5: Ticket and Check-in
1. Open the purchased ticket.
2. Check the ticket information and QR code.
3. Log in with a Staff account.
4. Scan or check the ticket.
5. Try checking in the same ticket again.
6. Check whether the system prevents duplicate check-ins.

### Flow 6: Admin Functions
1. Log in as Admin.
2. Open the admin page.
3. Check the available management functions.
4. Try accessing admin functions with a Customer account.
5. Check whether unauthorized access is blocked.

## 6. Test Result Recording

Every test case must have one of these results:

| Result | Meaning |
|---|---|
| PASS | The feature works as expected. |
| FAIL | The feature does not work as expected. |
| BLOCKED | Testing cannot continue because of another issue. |
| NOT TESTED | The test has not been performed. |
| RETEST PASS | A previously failed test now works. |
| RETEST FAIL | The problem still exists after fixing. |

Record the following information for each test:
- Test case ID.
- Feature being tested.
- Steps performed.
- Expected result.
- Actual result.
- Test status.
- Tester name.
- Screenshot or other evidence when necessary.

The team should use the same format to record results.

## 7. Bug Reporting with GitHub Issues

When a test fails, the tester must create a GitHub Issue.

Each issue should include:

- **Title:** A short description of the problem.
- **Severity:** The impact of the problem.
- **Environment:** Local or Render.
- **Steps to reproduce:** Clear steps that allow another member to repeat the problem.
- **Expected result:** What should happen.
- **Actual result:** What happened.
- **Screenshot or video:** Evidence of the problem.
- **Additional information:** Browser, device, or error message if relevant.

### Bug Severity

| Level | Description | Example |
|---|---|---|
| Critical | A major function is unavailable or causes serious data problems. | Users can pay but no order is created. |
| High | An important function does not work correctly. | Two users can book the same seat. |
| Medium | A function has an error but users can still use other main features. | Countdown timer displays incorrectly. |
| Low | A minor visual or text problem. | Incorrect button spacing or spelling. |

### Bug Tracking Process

1. Tester finds a problem.
2. Tester creates a GitHub Issue.
3. Tester adds the severity level and evidence.
4. Team leader assigns the issue to a developer.
5. Developer fixes the problem and updates the issue.
6. Tester checks the feature again.
7. If the problem is fixed, close the issue.
8. If the problem remains, keep the issue open and add new test results.

## 8. Team Coordination

All team members should:
- Use the same test cases and result labels.
- Record test results clearly.
- Report bugs through GitHub Issues.
- Avoid reporting the same bug multiple times.
- Update the issue when a bug is fixed or tested again.
- Share important testing results with the team.

## 9. Test Report

After testing, record the final results in:

`docs/test-report-m4.md`

The report should include:
- Total number of test cases.
- Number of passed and failed tests.
- Number of blocked and untested cases.
- List of important bugs.
- Links to related GitHub Issues.
- Screenshots or other evidence.
- Final testing summary.

## 10. Completion Criteria

Testing is considered complete when:
- The main user flows have been tested.
- Backend, frontend, and integration tests have been recorded.
- Important bugs have been reported.
- Fixed bugs have been tested again.
- The team has reviewed the final test report.
