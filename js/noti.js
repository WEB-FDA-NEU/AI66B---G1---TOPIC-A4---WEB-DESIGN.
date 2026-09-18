// Mock data and UI for Admin notifications

const MOCK_NOTI = [
    {
        "id": 1,
        "type": "sold_out",
        "title": "Concert sold out",
        "message": "Eternal Sunshine Tour 2026 has sold out all available tickets.",
        "time": "5 min ago",
        "read": false,
    },
    {
        "id": 2,
        "type": "system_error",
        "title": "Payment system error",
        "message": "Several **payment** attempts failed during checkout. Please check the `payment service`.",
        "time": "18 min ago",
        "read": false,
    },
    {
        "id": 3,
        "type": "customer_feedback",
        "title": "New customer complaint",
        "message": "A customer reported an issue with receiving their ticket after **payment**.",
        "time": "32 min ago",
        "read": false,
    },
    {
        "id": 4,
        "type": "low_stock",
        "title": "Tickets running low",
        "message": "Only 12 tickets remain for Circus Maximus World Tour.",
        "time": "1 hour ago",
        "read": false,
    },
    {
        "id": 5,
        "type": "check_in_error",
        "title": "Check-in system issue",
        "message": "Ticket scanning is temporarily unavailable at the main entrance.",
        "time": "2 hours ago",
        "read": true,
    },
    {
        "id": 6,
        "type": "customer_feedback",
        "title": "New customer feedback",
        "message": "A customer reported that the concert seating information was unclear.",
        "time": "3 hours ago",
        "read": true,
    },
    {
        "id": 7,
        "type": "concert_update",
        "title": "Concert schedule updated",
        "message": "The start time for After Hours Til Dawn has been changed to 8:30 PM.",
        "time": "5 hours ago",
        "read": true,
    },
    {
        "id": 8,
        "type": "system_error",
        "title": "Temporary server issue",
        "message": "The admin dashboard experienced a short service interruption and is now **operational**.",
        "time": "Yesterday",
        "read": true,
    },
]

const NOTIFICATION_ICONS = {
    sold_out: "fa-ticket",
    system_error: "fa-triangle-exclamation",
    customer_feedback: "fa-comment-dots",
    low_stock: "fa-box-open",
    check_in_error: "fa-qrcode",
    concert_update: "fa-calendar-check"
};

function escapeMarkdownHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

function renderMarkdown(value) {
    let html = escapeMarkdownHtml(value);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return html.replace(/\n/g, "<br>");
}

function renderNotifications() {
    const list = document.getElementById("notification-list");
    if (!list) return;

    list.innerHTML = MOCK_NOTI.map(notification => `
        <button type="button" class="notification-item${notification.read ? " is-read" : ""}" data-notification-id="${notification.id}">
            <span class="notification-icon notification-${notification.type}">
                <i class="fa-solid ${NOTIFICATION_ICONS[notification.type] || "fa-bell"}"></i>
            </span>
            <span class="notification-content">
                <strong>${notification.title}</strong>
                <span>${renderMarkdown(notification.message)}</span>
                <small>${notification.time}</small>
            </span>
            ${notification.read ? "" : '<span class="notification-unread" aria-label="Unread"></span>'}
        </button>
    `).join("");

    const unreadCount = MOCK_NOTI.filter(notification => !notification.read).length;
    const count = document.getElementById("notification-count");
    const dot = document.querySelector(".admin-icon-btn .dot");
    if (count) {
        count.textContent = unreadCount;
        count.hidden = unreadCount === 0;
    }
    if (dot) dot.hidden = unreadCount === 0;
}

function closeNotificationDropdown() {
    const dropdown = document.getElementById("notification-dropdown");
    const button = document.querySelector(".admin-icon-btn");
    if (!dropdown) return;
    dropdown.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
}

document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector(".admin-icon-btn");
    const dropdown = document.getElementById("notification-dropdown");
    const list = document.getElementById("notification-list");
    const markAllButton = document.getElementById("mark-notifications-read");
    if (!button || !dropdown || !list) return;

    renderNotifications();
    button.addEventListener("click", event => {
        event.stopPropagation();
        dropdown.hidden = !dropdown.hidden;
        button.setAttribute("aria-expanded", String(!dropdown.hidden));
    });
    list.addEventListener("click", event => {
        const item = event.target.closest("[data-notification-id]");
        if (!item) return;
        const notification = MOCK_NOTI.find(entry => String(entry.id) === item.dataset.notificationId);
        if (notification) notification.read = true;
        renderNotifications();
    });
    if (markAllButton) {
        markAllButton.addEventListener("click", () => {
            MOCK_NOTI.forEach(notification => { notification.read = true; });
            renderNotifications();
        });
    }
    document.addEventListener("click", event => {
        if (!dropdown.contains(event.target) && !button.contains(event.target)) closeNotificationDropdown();
    });
});