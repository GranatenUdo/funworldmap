-- daily_shared_by_method.sql
-- Count of daily_shared events grouped by dispatch method.
-- Recommended chart: stacked bar or pie, x=day (optional), y=count, stack=method.
-- Note: modesPlayed is not captured at the Worker level (v1.1 roadmap item).

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  blob4 AS method,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'daily_shared'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, method
ORDER BY day ASC, method ASC;
