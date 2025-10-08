import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'node:url';

export enum Tables {
    todos,
    shoppinglist
}

export interface DBEntry {
    title: string,
    isDone: boolean,
    createdAt: string
}
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../data/", "data.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(144) NOT NULL UNIQUE,
        isDone BOOLEAN NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS shoppinglist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(144) NOT NULL UNIQUE,
        isDone BOOLEAN NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

const createTodoStmt = db.prepare("INSERT INTO todos (title) VALUES (?)");
const createShoppingEntryStmt = db.prepare("INSERT INTO shoppinglist (title) VALUES (?)");
const getTodosAllStmt = db.prepare("SELECT title, isDone, createdAt FROM todos");
const getTodosOpenStmt = db.prepare("SELECT title, isDone, createdAt FROM todos WHERE isDone = 0");
const getShoppingEntriesAllStmt = db.prepare("SELECT title, isDone, createdAt FROM shoppinglist");
const getShoppingEntriesOpenStmt = db.prepare("SELECT title, isDone, createdAt FROM shoppinglist WHERE isDone = 0");
const setTodoIsDoneStmt = db.prepare("UPDATE todos SET isDone = ? WHERE title = ?");
const setTodoIsDoneStmtShoppingDoneStmt = db.prepare("UPDATE shoppinglist SET isDone = ? WHERE title = ?");
const clearTodosStmt = db.prepare("DELETE FROM todos WHERE isDone = 1");
const clearShoppingListStmt = db.prepare("DELETE FROM shoppinglist WHERE isDone = 1");

export async function createEntry(title: string, table: Tables) {
    try {
        switch (table) {
            case Tables.todos:
                createTodoStmt.run(title);
                break;
            case Tables.shoppinglist:
                createShoppingEntryStmt.run(title);
                break;
            default:
                break;
        }
    } catch (error: any) {
        throw new Error(`There was an error while creating the Entry: ${error.message}`);
    }
}

export async function getAllEntries(table: Tables) {
    try {
        let entries: DBEntry[] = [];
        switch (table) {
            case Tables.todos:
                entries = getTodosAllStmt.all() as DBEntry[];
                break;
            case Tables.shoppinglist:
                entries = getShoppingEntriesAllStmt.all() as DBEntry[];
                break;
            default:
                break;
        }
        return entries;
    } catch (error: any) {
        throw new Error(`There was an error while getting all entries: ${error.message}`);
    }
}

export async function getOpenEntries(table: Tables) {
    try {
        let entries: DBEntry[] = [];
        switch (table) {
            case Tables.todos:
                entries = getTodosOpenStmt.all() as DBEntry[];
                break;
            case Tables.shoppinglist:
                entries = getShoppingEntriesOpenStmt.all() as DBEntry[];
                break;
            default:
                break;
        }
        return entries;
    } catch (error: any) {
        throw new Error(`There was an error while getting open entries: ${error.message}`);
    }
}

export async function setDoneStatus(title: string, doneStatus: boolean, table: Tables) {
    const doneValue = doneStatus ? 1 : 0;
    try {
        switch (table) {
            case Tables.todos:
                setTodoIsDoneStmt.run(doneValue, title);
                break;
            case Tables.shoppinglist:
                setTodoIsDoneStmtShoppingDoneStmt.run(doneValue, title);
                break;
            default:
                break;
        }
    } catch (error: any) {
        throw new Error(`There was an error while setting isDone=${doneStatus}: ${error.message}`);
    }
}

export async function clearDone(table: Tables) {
    try {
        switch (table) {
            case Tables.todos:
                clearTodosStmt.run();
                break;
            case Tables.shoppinglist:
                clearShoppingListStmt.run();
                break;
            default:
                break;
        }
    } catch (error: any) {
        throw new Error(`There was an error while clearing entries: ${error.message}`);
    }
}