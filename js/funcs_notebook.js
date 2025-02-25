// All SQLite operations now use the `window.dbAPI` provided by the preload script.

//=======================================================================================================
// UTILITY FUNCTIONS

function htmlEncode(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#39;");
}

function htmlDecode(text) {
    return text.replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&lt;/g, "<")
               .replace(/&gt;/g, ">")
               .replace(/&amp;/g, "&");
}

// Base32 alphabet (RFC 4648 standard)
const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Converts a string to Base32.
 * @param {string} input - The string to encode.
 * @returns {string} - The Base32 encoded string.
 */
function textToBase32(input) {
    let binary = "";
    for (let i = 0; i < input.length; i++) {
        binary += input.charCodeAt(i).toString(2).padStart(8, '0');
    }

    let base32 = "";
    for (let i = 0; i < binary.length; i += 5) {
        const chunk = binary.slice(i, i + 5).padEnd(5, '0');
        base32 += base32Alphabet[parseInt(chunk, 2)];
    }

    // Add padding to make the length a multiple of 8
    while (base32.length % 8 !== 0) {
        base32 += "=";
    }

    return base32;
}

/**
 * Converts a Base32 encoded string back to text.
 * @param {string} base32 - The Base32 encoded string.
 * @returns {string} - The decoded string.
 */
function base32ToText(base32) {
    // Remove padding
    base32 = base32.replace(/=+$/, "");

    let binary = "";
    for (let i = 0; i < base32.length; i++) {
        const index = base32Alphabet.indexOf(base32[i]);
        if (index === -1) {
            throw new Error("Invalid Base32 character.");
        }
        binary += index.toString(2).padStart(5, '0');
    }

    let text = "";
    for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.slice(i, i + 8);
        if (byte.length === 8) {
            text += String.fromCharCode(parseInt(byte, 2));
        }
    }

    return text;
}

/**
 * Removes padding from Base32 text and prepends an underscore.
 * @param {string} base32 - The Base32 text to process.
 * @returns {string} - The processed string with padding removed and an underscore prepended.
 */
function processBase32(base32) {
    // Remove padding characters
    const withoutPadding = base32.replace(/=+$/, "");
    // Prepend an underscore
    return "_" + withoutPadding;
}

/**
 * Reverts the processing of Base32 text.
 * Removes the prepended underscore and restores padding.
 * @param {string} processedBase32 - The processed Base32 text.
 * @returns {string} - The original Base32 string with padding restored.
 */
function unProcessBase32(processedBase32) {
    // Remove the underscore
    if (processedBase32[0] !== "_") {
        throw new Error("Invalid format: Missing prepended underscore.");
    }
    const withoutUnderscore = processedBase32.slice(1);

    // Restore padding to make the length a multiple of 8
    const paddingLength = (8 - (withoutUnderscore.length % 8)) % 8;
    const restoredBase32 = withoutUnderscore + "=".repeat(paddingLength);

    return restoredBase32;
}

/**
 * Encode a column name to Base32 format for database use.
 * @param {string} columnName - Original column name.
 * @returns {string} - Encoded column name.
 */
function encodeColumnName(columnName) {
    return processBase32(textToBase32(columnName));
}

/**
 * Decode a Base32 column name back to its original name.
 * @param {string} encodedName - Encoded column name.
 * @returns {string} - Original column name.
 */
function decodeColumnName(encodedName) {
    return base32ToText(unProcessBase32(encodedName));
}

/**
 * Log errors with a consistent format.
 * @param {string} message - Contextual message for the error.
 * @param {Error} error - Error object.
 */
function logError(message, error) {
    console.error(`${message}:`, error.message);
}



//==============================================================================================

/**
 * Update a note in the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @param {number} noteId - ID of the note to update.
 * @param {Object} updates - Dictionary of column names (keys) and their new values (values).
 * @returns {Promise<void>}
 */
async function BEEditNoteColumn(notebookName, noteId, updates) {
    if (Object.keys(updates).length === 0) {
        console.warn('No updates provided. Operation aborted.');
        return;
    }

    try {
        // Encode column names for database compatibility
        //const columns = Object.keys(updates).map(encodeColumnName);
        const columns = Object.keys(updates);
        const values = Object.values(updates);

        // Construct the SET clause dynamically
        const setClause = columns.map(col => `${col} = ?`).join(', ');

        // Update query
        const query = `UPDATE Notes SET ${setClause} WHERE _note_id = ?;`;

        // Execute the query with the new values and note ID
        await window.dbAPI.executeQuery(notebookName, query, [...values, noteId]);

        console.log(`Note with ID '${noteId}' updated successfully.`);
    } catch (error) {
        logError(`Error updating note with ID '${noteId}'`, error);
    }
}

/**
 * Update the content of a specific note.
 * @param {string} notebookName - Notebook database name.
 * @param {number} noteId - ID of the note to update.
 * @param {string} newContent - New content for the note.
 * @returns {Promise<void>}
 */
async function BEEditNoteContent(notebookName, noteId, newContent) {
    const query = `UPDATE Notes SET _note_content = ? WHERE _note_id = ?;`;
    try {
        await window.dbAPI.executeQuery(notebookName, query, [newContent, noteId]);
        console.log(`Content for note ID '${noteId}' updated successfully.`);
    } catch (error) {
        logError(`Error updating content for note ID '${noteId}'`, error);
    }
}


//=======================================================================================================
// MODIFIERS & SETTERS

/**
 * Create a new notebook database with necessary tables.
 * @param {string} notebookName - Name of the notebook database.
 */
async function BECreateNewNotebook(notebookName) {
    try {
        const createMetaTable = `CREATE TABLE IF NOT EXISTS MetaData (_notebook_name TEXT PRIMARY KEY);`;
        const createNotesTable = `CREATE TABLE IF NOT EXISTS Notes (_note_id INTEGER PRIMARY KEY AUTOINCREMENT, _note_content BLOB);`;

        await window.dbAPI.executeQuery(notebookName, createMetaTable);
        await window.dbAPI.executeQuery(notebookName, createNotesTable);

        const insertNotebookName = `INSERT INTO MetaData (_notebook_name) VALUES (?);`;
        await window.dbAPI.executeQuery(notebookName, insertNotebookName, [notebookName]);

        console.log('Notebook setup completed successfully.');
    } catch (error) {
        logError('Error during notebook creation', error);
    }
}

/**
 * Update the notebook name in the metadata table.
 * @param {string} notebookName - Current notebook name.
 * @param {string} newNotebookName - New notebook name.
 */
async function BEEditTitle(notebookName, newNotebookName) {
    const query = `UPDATE MetaData SET _notebook_name = ? WHERE _notebook_name IS NOT NULL;`;
    try {
        await window.dbAPI.executeQuery(notebookName, query, [newNotebookName]);
        console.log(`Notebook name updated to '${newNotebookName}'.`);
    } catch (error) {
        logError('Error updating notebook name', error);
    }
}

/**
 * Add a new column to the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @param {string} columnName - New column name.
 */
async function BEAddColumn(notebookName, columnName) {
    const encodedName = encodeColumnName(columnName);
    const query = `ALTER TABLE Notes ADD COLUMN ${encodedName} TEXT DEFAULT NULL;`;
    try {
        await window.dbAPI.executeQuery(notebookName, query);
        console.log(`Column '${encodedName}' added successfully.`);
    } catch (error) {
        logError('Error adding column', error);
    }
}

/**
 * Delete a column from the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @param {string} columnName - Column name to delete.
 */
async function BEDeleteColumn(notebookName, columnName) {
    const encodedName = encodeColumnName(columnName);
    const query = `ALTER TABLE Notes DROP COLUMN ${encodedName};`;
    try {
        await window.dbAPI.executeQuery(notebookName, query);
        console.log(`Column '${encodedName}' deleted successfully.`);
    } catch (error) {
        logError('Error deleting column', error);
    }
}

/**
 * Rename a column in the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @param {string} oldColumnName - Current column name.
 * @param {string} newColumnName - New column name.
 */
async function BERenameColumn(notebookName, oldColumnName, newColumnName) {
    const encodedOldName = encodeColumnName(oldColumnName);
    const encodedNewName = encodeColumnName(newColumnName);
    const query = `ALTER TABLE Notes RENAME COLUMN ${encodedOldName} TO ${encodedNewName};`;
    try {
        await window.dbAPI.executeQuery(notebookName, query);
        console.log(`Column renamed from '${encodedOldName}' to '${encodedNewName}'.`);
    } catch (error) {
        logError('Error renaming column', error);
    }
}

/**
 * Add a new note to the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @param {string} noteContent - Note content.
 * @param {Object} extraColumns - Additional column values (key-value pairs).
 */
async function BEAddNewNote(notebookName, noteContent, extraColumns = {}) {
    const columns = ['_note_content'];
    const values = [noteContent];

    for (const [colName, colValue] of Object.entries(extraColumns)) {
        //columns.push(encodeColumnName(colName));
        columns.push(colName);
        values.push(colValue);
    }

    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO Notes (${columns.join(', ')}) VALUES (${placeholders});`;

    try {
        const result = await window.dbAPI.executeQuery(notebookName, query, values);
        console.log(result.lastID);
        return result.lastID; // Return the last inserted note ID
    } catch (error) {
        logError('Error adding new note', error);
        return null;
    }
}

/**
 * Delete a note from the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @param {number} noteId - ID of the note to delete.
 */
async function BEDeleteNote(notebookName, noteId) {
    const query = `DELETE FROM Notes WHERE _note_id = ?;`;
    try {
        await window.dbAPI.executeQuery(notebookName, query, [noteId]);
        console.log(`Note with ID '${noteId}' deleted successfully.`);
    } catch (error) {
        logError('Error deleting note', error);
    }
}



//=======================================================================================================
// GETTERS

/**
 * Retrieve the notebook title from the MetaData table.
 * @param {string} notebookName - Notebook database name.
 * @returns {Promise<string>} - Notebook title.
 */
async function BEGetTitle(notebookName) {
    const query = `SELECT _notebook_name FROM MetaData;`;
    try {
        const result = await window.dbAPI.executeSelectQuery(notebookName, query);
        console.log('Notebook name successfully retrieved.');
        return result[0]?._notebook_name || '';
    } catch (error) {
        logError('Error retrieving notebook title', error);
        return '';
    }
}

/**
 * Retrieve the list of column names (excluding system columns) from the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @returns {Promise<string[]>} - List of column names.
 */
async function BEGetColumns(notebookName) {
    const query = `SELECT name FROM pragma_table_info('Notes') WHERE name NOT IN ('_note_id', '_note_content');`;
    try {
        const columns = await window.dbAPI.executeSelectQuery(notebookName, query);
        console.log('Column names retrieved successfully.');
        return columns.map(col => col.name);
    } catch (error) {
        logError('Error retrieving column names', error);
        return [];
    }
}

/**
 * Retrieve the list of column names decoded from Base32 format.
 * @param {string} notebookName - Notebook database name.
 * @returns {Promise<string[]>} - List of decoded column names.
 */
async function BEGetColumns_Alt(notebookName) {
    try {
        const columns = await BEGetColumns(notebookName);
        const decodedColumns = columns.map(decodeColumnName);
        console.log('Decoded column names retrieved successfully.');
        return decodedColumns;
    } catch (error) {
        logError('Error retrieving decoded column names', error);
        return [];
    }
}

/**
 * Retrieve all notes from the Notes table.
 * @param {string} notebookName - Notebook database name.
 * @returns {Promise<Object[]>} - List of notes with all fields.
 */
async function BEGetAllNotes(notebookName) {
    const schemaQuery = `PRAGMA table_info(Notes);`;
    try {
        const columnsInfo = await window.dbAPI.executeSelectQuery(notebookName, schemaQuery);
        const columns = columnsInfo.map(col => col.name).filter(name => name !== '_note_content').join(', ');

        if (!columns) {
            console.warn('No valid columns found in Notes table.');
            return [];
        }

        const query = `SELECT ${columns} FROM Notes;`;
        const notes = await window.dbAPI.executeSelectQuery(notebookName, query);
        console.log('All notes retrieved successfully.');
        return notes;
    } catch (error) {
        logError('Error retrieving all notes', error);
        return [];
    }
}

/**
 * Retrieve a note by its ID with all its fields.
 * @param {string} notebookName - Notebook database name.
 * @param {number} noteId - ID of the note to retrieve.
 * @returns {Promise<Object>} - Note object containing all fields or null if not found.
 */
async function BEGetNote(notebookName, noteId) {
    const schemaQuery = `PRAGMA table_info(Notes);`;
    try {
        // Get all columns in the Notes table
        const columnsInfo = await window.dbAPI.executeSelectQuery(notebookName, schemaQuery);
        const columns = columnsInfo.map(col => col.name).join(', ');

        if (!columns) {
            console.warn('No valid columns found in Notes table.');
            return null;
        }

        // Query for the note by its ID
        const query = `SELECT ${columns} FROM Notes WHERE _note_id = ?;`;
        const result = await window.dbAPI.executeSelectQuery(notebookName, query, [noteId]);

        if (result.length === 0) {
            console.warn(`No note found with ID '${noteId}'.`);
            return null;
        }

        console.log(`Note with ID '${noteId}' retrieved successfully.`);
        return result[0]; // Return the first (and only) result
    } catch (error) {
        logError(`Error retrieving note with ID '${noteId}'`, error);
        return null;
    }
}

/**
 * Retrieve the content of a specific note by ID.
 * @param {string} notebookName - Notebook database name.
 * @param {number} noteId - ID of the note to retrieve.
 * @returns {Promise<string>} - Content of the note.
 */
async function BEGetNoteContent(notebookName, noteId) {
    const query = `SELECT _note_content FROM Notes WHERE _note_id = ?;`;
    try {
        const result = await window.dbAPI.executeSelectQuery(notebookName, query, [noteId]);
        console.log(`Content of note ID '${noteId}' retrieved successfully.`);
        return result[0]?._note_content || '';
    } catch (error) {
        logError(`Error retrieving content for note ID '${noteId}'`, error);
        return '';
    }
}

/**
 * Retrieve a mapping of Base32 column names to their decoded counterparts.
 * @param {string} notebookName - Notebook database name.
 * @returns {Promise<Object>} - Mapping object { base32Name: decodedName }.
 */
async function BEGetColumnNameMapping(notebookName) {
    const query = `SELECT name FROM pragma_table_info('Notes') WHERE name NOT IN ('_note_id', '_note_content');`;
    try {
        const columns = await window.dbAPI.executeSelectQuery(notebookName, query);
        const columnMapping = columns.reduce((acc, col) => {
            const decodedName = decodeColumnName(col.name);
            acc[col.name] = decodedName;
            return acc;
        }, {});

        console.log('Column name mapping retrieved successfully.');
        return columnMapping;
    } catch (error) {
        logError('Error retrieving column name mapping', error);
        return {};
    }
}

//=======================================================================================================

module.exports = {
    BECreateNewNotebook,
    BEEditTitle,
    BEAddColumn,
    BEDeleteColumn,
    BERenameColumn,
    BEAddNewNote,
    BEDeleteNote,
    BEEditNoteColumn,
    BEEditNoteContent,
    BEGetTitle,
    BEGetColumns,
    BEGetColumns_Alt,
    BEGetColumnNameMapping,
    BEGetAllNotes,
    BEGetNoteContent,
    BEGetNote
};
