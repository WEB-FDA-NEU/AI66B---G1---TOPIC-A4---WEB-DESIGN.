docs/demo-script.md

**Demo duration:** 10 minutes  
**Environment:** Deployed application (Render + Neon)  
**Target:** Demonstrate the main user and admin workflows.

## 1. Team Responsibilities

| Role | Person in charge | Responsibility |
|---|---|---|
| Main Presenter | [Member 1] | Introduction and system overview |
| User Demo | [Member 2] | Login, browse concerts, select seats and book tickets |
| Admin Demo | [Member 3] | Admin dashboard and booking management |
| Technical Support | [Member 4] | Prepare accounts, monitor deployment and handle technical issues |

Replace the placeholders with actual team member names before the presentation.

## 2. 10-Minute Demo Timeline

| Time | Presenter | Demo activity | Expected result |
|---|---|---|---|
| 00:00–01:00 | Member 1 | Introduce the project and its main purpose | Audience understands the system |
| 01:00–02:00 | Member 2 | Open the deployed website and log in as a User | User account logs in successfully |
| 02:00–03:00 | Member 2 | Browse the concert list and open concert details | Concert information is displayed |
| 03:00–04:30 | Member 2 | Select an available seat and hold it | Seat is held successfully |
| 04:30–05:30 | Member 2 | Show the countdown and complete mock payment | Booking is confirmed |
| 05:30–06:30 | Member 2 | Open booking details and show the ticket QR code | Ticket information and QR code are displayed |
| 06:30–08:30 | Member 3 | Log in as Admin and show the dashboard and booking management | Admin functions are demonstrated |
| 08:30–09:30 | Member 3 | Demonstrate ticket check-in using the QR code | Check-in result is displayed |
| 09:30–10:00 | Member 1 | Summarize the main features and conclude | Demo is completed |

## 3. Accounts and Demo Data Preparation

Prepare the following before the presentation.

### Test accounts

| Account | Purpose | Credentials |
|---|---|---|
| User account | Browse concerts and book tickets | [Prepare valid User credentials] |
| Admin account | Access dashboard and manage bookings | [Prepare valid Admin credentials] |

Do not put real passwords in this document. Keep credentials available to the demo team securely.

### Concert data

Prepare at least one concert with:

- Complete concert name and description.
- Valid date, time and venue.
- Available seats.
- At least one available seat for booking.
- Ticket price and other required information.

### Booking data

Prepare:

- One available seat for the User demo.
- One successful booking for displaying ticket details.
- A valid QR code for the check-in demonstration.
- An Admin account with access to the relevant management functions.

Use pre-created data where possible. Do not depend on manually editing the production database during the presentation.

## 4. Slide Preparation

Prepare a short slide deck covering:

1. Project introduction and objectives.
2. Main system features.
3. User booking workflow.
4. Admin management workflow.
5. System deployment and technologies.
6. Conclusion.

Keep slides short. Use the live deployed application to demonstrate actual functionality.

## 5. Rehearsal Checklist

Run the complete demo twice on the deployed application before presentation day.

### First rehearsal

- [ ] Open the deployed website.
- [ ] Log in with the User account.
- [ ] Browse the prepared concert.
- [ ] Select and hold a seat.
- [ ] Check the countdown.
- [ ] Complete mock payment.
- [ ] Open booking details and QR code.
- [ ] Log in with the Admin account.
- [ ] Open the Admin dashboard.
- [ ] Demonstrate ticket check-in.
- [ ] Check that the complete flow finishes within 10 minutes.

### Second rehearsal

- [ ] Repeat the complete demo from the beginning.
- [ ] Confirm that all accounts still work.
- [ ] Confirm that seats and booking data are ready.
- [ ] Confirm that the QR code can be checked in.
- [ ] Confirm that no manual database editing is needed.
- [ ] Finish within 10 minutes.

## 6. Before the Presentation

Approximately 5 minutes before the presentation:

- [ ] Open the deployed application.
- [ ] Allow Render and Neon to start if they were suspended.
- [ ] Check that the website loads correctly.
- [ ] Check User and Admin login.
- [ ] Keep the required browser tabs ready.
- [ ] Prepare slides and the demo environment.
- [ ] Ensure all team members know their presentation order.

## 7. Backup Plan

If a live function fails:

- Move to the next prepared demo step.
- Use previously prepared screenshots or recordings to explain the intended workflow.
- Do not manually modify production database records during the presentation.
- The technical support member should investigate the issue without interrupting the main presenter.

## 8. Acceptance Criteria

- [ ] A 10-minute demo script is available.
- [ ] Each demo section has a clearly assigned presenter.
- [ ] User and Admin accounts are ready.
- [ ] Concert, seat, booking and QR data are prepared.
- [ ] Slides are ready.
- [ ] The full demo succeeds twice consecutively on the deployed application.
- [ ] Important functions do not depend on manual data changes during the presentation.
- [ ] The deployed application is opened approximately 5 minutes before the demo.
