-- daily_funnel.sql
-- daily_started → daily_completed conversion funnel per day.
-- Recommended chart: stacked bar, x=day, y=count, stack=name.

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  index1 AS name,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 IN ('daily_started', 'daily_completed')
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, name
ORDER BY day ASC, name ASC;
