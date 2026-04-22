-- streak_milestone_distribution.sql
-- Distribution of streak_reached_milestone firings by threshold (3/7/14/30/100).
-- Recommended chart: bar, x=threshold, y=count.

SELECT
  double6 AS milestone_days,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'streak_reached_milestone'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY milestone_days
ORDER BY milestone_days ASC;
