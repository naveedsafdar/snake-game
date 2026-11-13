/* =========================================================
   Snake: talking to the database (Supabase)

   Every function here returns null (or false) instead of throwing when the
   database isn't set up or can't be reached, so the game keeps working
   offline; it just doesn't save anything.
   ========================================================= */
"use strict";

// Connect once, only if config.js has been filled in
const db = (SUPABASE_URL && SUPABASE_KEY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const Database = {
  // true when scores can be saved
  isReady() {
    return db !== null;
  },

  // Create the player (or find them if the name was used before).
  // Returns the player's id, or null.
  async registerPlayer(name) {
    return call("register_player", { p_name: name });
  },

  // Save a finished game. Returns true if it's a new personal best,
  // false if not, or null if it couldn't be saved.
  async submitScore(playerId, score) {
    return call("submit_score", { p_player_id: playerId, p_score: score });
  },

  // Top single games: [{ name, score, played_at }, ...] or null
  async getLeaderboard(limit = 5) {
    return call("get_leaderboard", { p_limit: limit });
  },

  // { total_games, total_players } or null
  async getStats() {
    return call("get_stats");
  }
};

// Run one of the database functions from supabase/schema.sql
async function call(functionName, args) {
  if (!db) return null;
  try {
    const { data, error } = await db.rpc(functionName, args);
    if (error) {
      console.warn("Database error in " + functionName + ":", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Could not reach the database:", err);
    return null;
  }
}
