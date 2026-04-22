-- history_opened_rate.sql
-- Count of history_opened events per calendar day.
-- Recommended chart: line, x=day, y=count.

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'history_opened'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day ASC;
