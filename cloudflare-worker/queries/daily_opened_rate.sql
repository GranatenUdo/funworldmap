-- daily_opened_rate.sql
-- Count of daily_opened events per calendar day, grouped by mode.
-- Recommended chart: line, x=day, y=count, color=mode.

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  blob2 AS mode,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'daily_opened'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, mode
ORDER BY day ASC, mode ASC;
