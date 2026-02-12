-- ===============================================================================
-- GTA BOT WEBSITE - Supabase stats & leaderboards (run in Supabase SQL Editor)
-- ===============================================================================
-- Run this in your Supabase project after you have a `users` table with columns:
--   user_id, cash, bank_balance, chips, rep, rank, total_earned, total_spent,
--   total_jobs_completed, total_heists_completed, total_steals_attempted,
--   total_casino_games_played, total_casino_winnings, total_casino_losses,
--   total_playtime_minutes, session_count, daily_streak, last_activity,
--   first_seen, achievements (jsonb), wanted_level
-- If your bot uses Neon, sync/copy the users table to Supabase or use Supabase
-- as the primary DB and ensure this schema matches.
-- ===============================================================================

-- Optional: add level column if not present (bot may compute from total_rp)
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_rp BIGINT DEFAULT 0;

-- ===============================================================================
-- Global stats (single row) - RPC for website
-- ===============================================================================
CREATE OR REPLACE FUNCTION get_server_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*)::BIGINT FROM users),
    'total_cash_in_economy', (SELECT COALESCE(SUM(cash + bank_balance + chips), 0)::BIGINT FROM users),
    'total_earned_all_users', (SELECT COALESCE(SUM(total_earned), 0)::BIGINT FROM users),
    'total_spent_all_users', (SELECT COALESCE(SUM(total_spent), 0)::BIGINT FROM users),
    'total_wallet_money', (SELECT COALESCE(SUM(cash), 0)::BIGINT FROM users),
    'total_bank_money', (SELECT COALESCE(SUM(bank_balance), 0)::BIGINT FROM users),
    'total_chips', (SELECT COALESCE(SUM(chips), 0)::BIGINT FROM users),
    'total_reputation', (SELECT COALESCE(SUM(rep), 0)::BIGINT FROM users),
    'total_jobs_completed', (SELECT COALESCE(SUM(total_jobs_completed), 0)::BIGINT FROM users),
    'total_heists_completed', (SELECT COALESCE(SUM(total_heists_completed), 0)::BIGINT FROM users),
    'total_casino_games_played', (SELECT COALESCE(SUM(total_casino_games_played), 0)::BIGINT FROM users),
    'active_users_24h', (SELECT COUNT(*)::BIGINT FROM users WHERE last_activity > NOW() - INTERVAL '24 hours'),
    'new_users_today', (SELECT COUNT(*)::BIGINT FROM users WHERE first_seen > CURRENT_DATE),
    'highest_level', (SELECT COALESCE(MAX(COALESCE(level, 1)), 1) FROM users),
    'richest_net_worth', (SELECT COALESCE(MAX(cash + bank_balance + chips), 0)::BIGINT FROM users)
  ) INTO result;
  RETURN result;
END;
$$;

-- ===============================================================================
-- Top N leaderboard by stat - RPC for website (Top 100 each category)
-- ===============================================================================
CREATE OR REPLACE FUNCTION get_leaderboard_top(leaderboard_type TEXT, limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
  rank bigint,
  user_id text,
  value bigint,
  display text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  limit_count := LEAST(COALESCE(limit_count, 100), 100);

  IF leaderboard_type = 'cash' THEN
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY u.cash DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      u.cash::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY u.cash DESC NULLS LAST
    LIMIT limit_count;
  ELSIF leaderboard_type = 'bank' THEN
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY u.bank_balance DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      u.bank_balance::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY u.bank_balance DESC NULLS LAST
    LIMIT limit_count;
  ELSIF leaderboard_type = 'chips' THEN
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY u.chips DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      u.chips::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY u.chips DESC NULLS LAST
    LIMIT limit_count;
  ELSIF leaderboard_type = 'rep' OR leaderboard_type = 'notorious' THEN
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY u.rep DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      u.rep::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY u.rep DESC NULLS LAST
    LIMIT limit_count;
  ELSIF leaderboard_type = 'level' THEN
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY COALESCE(u.level, 1) DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      COALESCE(u.level, 1)::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY COALESCE(u.level, 1) DESC NULLS LAST
    LIMIT limit_count;
  ELSIF leaderboard_type = 'net_worth' OR leaderboard_type = 'wealth' THEN
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY (u.cash + u.bank_balance + u.chips) DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      (u.cash + u.bank_balance + u.chips)::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY (u.cash + u.bank_balance + u.chips) DESC NULLS LAST
    LIMIT limit_count;
  ELSE
    -- default: net_worth
    RETURN QUERY
    SELECT
      row_number() OVER (ORDER BY (u.cash + u.bank_balance + u.chips) DESC NULLS LAST)::BIGINT AS rank,
      u.user_id,
      (u.cash + u.bank_balance + u.chips)::BIGINT AS value,
      u.rank AS display
    FROM users u
    ORDER BY (u.cash + u.bank_balance + u.chips) DESC NULLS LAST
    LIMIT limit_count;
  END IF;
END;
$$;

-- Grant execute to anon (for website)
GRANT EXECUTE ON FUNCTION get_server_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_top(TEXT, INTEGER) TO anon;

-- Optional: allow anon to read leaderboard view only (no raw users table needed for top 100 if using RPC above)
-- No additional grants needed; RPC runs with SECURITY DEFINER.
