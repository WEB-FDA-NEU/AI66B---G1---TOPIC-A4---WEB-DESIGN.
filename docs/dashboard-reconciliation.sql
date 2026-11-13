-- Chỉ đọc. Chạy trên snapshot nhất quán, không thay đổi dữ liệu.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_timestamp AS audited_at, current_setting('TimeZone') AS database_timezone;
SELECT
 (SELECT count(*) FROM concerts) AS "totalConcerts",
 (SELECT count(*) FROM orders) AS "totalOrders",
 (SELECT coalesce(sum(total_amount-refund_amount),0) FROM orders WHERE payment_status='paid') AS "totalRevenue",
 (SELECT count(*) FROM tickets WHERE status IN ('valid','used')) AS "ticketsSold",
 (SELECT count(*) FROM concerts WHERE starts_at>now() AND status IN ('on_sale','sold_out')) AS "upcomingConcerts",
 (SELECT count(*) FROM tickets WHERE status='used' AND checked_in_at>=date_trunc('day',now())) AS "checkinsToday";

-- Đối chiếu theo concert, tránh JOIN trực tiếp nhiều quan hệ 1-n làm nhân tổng.
SELECT c.id,
 (SELECT coalesce(sum(z.capacity),0) FROM zones z WHERE z.concert_id=c.id) AS capacity,
 (SELECT coalesce(sum(o.total_amount-o.refund_amount),0) FROM orders o WHERE o.concert_id=c.id AND o.payment_status='paid') AS revenue,
 (SELECT count(*) FROM tickets t WHERE t.concert_id=c.id AND t.status IN ('valid','used')) AS tickets_sold,
 (SELECT count(*) FROM tickets t WHERE t.concert_id=c.id AND t.status='used') AS checked_in,
 c.starts_at>now() AND c.status IN ('on_sale','sold_out') AS upcoming,
 (SELECT count(*) FROM seats s JOIN zones z ON z.id=s.zone_id WHERE z.concert_id=c.id AND (s.status='available' OR (s.status='held' AND s.held_until<=current_timestamp))) AS available_inventory,
 (SELECT count(*) FROM seats s JOIN zones z ON z.id=s.zone_id WHERE z.concert_id=c.id AND s.status='held' AND s.held_until>current_timestamp) AS held_inventory,
 (SELECT count(*) FROM seats s JOIN zones z ON z.id=s.zone_id WHERE z.concert_id=c.id AND s.status='sold') AS sold_inventory
FROM concerts c ORDER BY c.starts_at,c.id;

-- Chỉ các đơn đã từng phát hành vé: pending/failed/cancelled chưa trả tiền không có ticket.
SELECT o.id,o.total_amount,coalesce(sum(t.price),0) AS issued_ticket_amount,
 o.total_amount=coalesce(sum(t.price),0) AS amount_matches
FROM orders o LEFT JOIN tickets t ON t.order_id=o.id
WHERE o.payment_status IN ('paid','refunded')
GROUP BY o.id ORDER BY o.id;

-- Ghế sold thiếu vé có hiệu lực: seed soldOut có chủ đích, dữ liệu thật cần điều tra.
SELECT z.concert_id,z.id AS zone_id,count(*) AS sold_without_active_ticket
FROM seats s JOIN zones z ON z.id=s.zone_id
WHERE s.status='sold' AND NOT EXISTS (
 SELECT 1 FROM tickets t WHERE t.seat_id=s.id AND t.status IN ('valid','used'))
GROUP BY z.concert_id,z.id ORDER BY z.concert_id,z.id;
-- Vé có hiệu lực nhưng inventory không sold: luôn cần điều tra.
SELECT t.id AS ticket_id FROM tickets t JOIN seats s ON s.id=t.seat_id
WHERE t.status IN ('valid','used') AND s.status<>'sold';
COMMIT;
