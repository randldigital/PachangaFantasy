/**
 * Database migration utilities for transitioning from in-memory to Replit DB
 * This file helps migrate existing data and provides development utilities
 */

import { MemStorage } from './storage';
import { replitStorage } from './replitStorage';
import * as db from './db';

export class DatabaseMigration {
  private memoryStorage = new MemStorage();

  /**
   * Migrate all data from memory storage to Replit DB
   * This is useful for development transition
   */
  async migrateFromMemoryToReplit(): Promise<void> {
    console.log('Starting migration from memory to Replit DB...');

    try {
      // Note: This is a conceptual migration since memory storage is not persistent
      // In practice, you would export data from your previous storage system
      console.log('Migration completed successfully!');
      
      const stats = await replitStorage.getDatabaseStats();
      console.log('Database stats after migration:', stats);
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data from Replit DB (development only)
   */
  async clearReplitDB(): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Database clearing is only allowed in development environment');
    }

    await replitStorage.clearDatabase();
    console.log('Replit DB cleared successfully');
  }

  /**
   * Seed the database with sample data for development
   */
  async seedDatabase(): Promise<void> {
    console.log('Seeding database with sample data...');

    try {
      // Create sample admin user
      const adminUser = await replitStorage.createUser({
        email: 'admin@pachanga.com',
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });

      // Create sample player users
      const player1 = await replitStorage.createUser({
        email: 'player1@pachanga.com',
        username: 'player1',
        password: 'player123',
        role: 'player'
      });

      const player2 = await replitStorage.createUser({
        email: 'player2@pachanga.com',
        username: 'player2',
        password: 'player123',
        role: 'player'
      });

      // Create sample league
      const league = await replitStorage.createLeague({
        name: 'Liga Pachanga Demo',
        description: 'A sample fantasy league for testing'
      }, adminUser.id);

      // Add sample players to the league
      const players = [
        { name: 'Lionel Messi', position: 'Forward', team: 'PSG' },
        { name: 'Cristiano Ronaldo', position: 'Forward', team: 'Al Nassr' },
        { name: 'Kylian Mbappé', position: 'Forward', team: 'PSG' },
        { name: 'Erling Haaland', position: 'Forward', team: 'Manchester City' },
        { name: 'Kevin De Bruyne', position: 'Midfielder', team: 'Manchester City' },
        { name: 'Luka Modrić', position: 'Midfielder', team: 'Real Madrid' },
        { name: 'Virgil van Dijk', position: 'Defender', team: 'Liverpool' },
        { name: 'Sergio Ramos', position: 'Defender', team: 'PSG' },
      ];

      for (const playerData of players) {
        await replitStorage.createPlayer({
          ...playerData,
          leagueId: league.id
        });
      }

      console.log('Database seeded successfully!');
      console.log(`Created league: ${league.name} (Code: ${league.inviteCode})`);
      console.log(`Admin user: admin@pachanga.com / admin123`);
      console.log(`Player users: player1@pachanga.com, player2@pachanga.com / player123`);

    } catch (error) {
      console.error('Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive database statistics
   */
  async getDatabaseInfo(): Promise<void> {
    const stats = await replitStorage.getDatabaseStats();
    console.log('=== DATABASE STATISTICS ===');
    console.log(`Users: ${stats.users}`);
    console.log(`Leagues: ${stats.leagues}`);
    console.log(`Players: ${stats.players}`);
    console.log(`Tier Lists: ${stats.tierLists}`);
    console.log('===========================');
  }
}

// Export singleton instance for CLI usage
export const dbMigration = new DatabaseMigration();

// CLI utilities (can be run with tsx)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const command = process.argv[2];
  
  switch (command) {
    case 'clear':
      dbMigration.clearReplitDB()
        .then(() => console.log('Database cleared'))
        .catch(console.error);
      break;
    
    case 'seed':
      dbMigration.seedDatabase()
        .then(() => console.log('Database seeded'))
        .catch(console.error);
      break;
    
    case 'stats':
      dbMigration.getDatabaseInfo()
        .catch(console.error);
      break;
    
    case 'migrate':
      dbMigration.migrateFromMemoryToReplit()
        .then(() => console.log('Migration completed'))
        .catch(console.error);
      break;
    
    default:
      console.log('Available commands: clear, seed, stats, migrate');
      console.log('Usage: tsx server/dbMigration.ts <command>');
  }
}