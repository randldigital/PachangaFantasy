-- Half-step Market Values (e.g. 19.5 → 9.75M display).
ALTER TABLE "players"
  ALTER COLUMN "market_value" TYPE double precision
  USING "market_value"::double precision;

ALTER TABLE "match_player_vm"
  ALTER COLUMN "market_value" TYPE double precision
  USING "market_value"::double precision;

ALTER TABLE "player_market_value_history"
  ALTER COLUMN "vm_before" TYPE double precision
  USING "vm_before"::double precision;

ALTER TABLE "player_market_value_history"
  ALTER COLUMN "vm_after" TYPE double precision
  USING "vm_after"::double precision;

ALTER TABLE "player_market_value_history"
  ALTER COLUMN "delta" TYPE double precision
  USING "delta"::double precision;

-- Lineup cost is the sum of player VMs; half-steps need a float total.
ALTER TABLE "lineups"
  ALTER COLUMN "total_cost" TYPE double precision
  USING "total_cost"::double precision;
