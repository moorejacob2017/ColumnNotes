// funcs_sqlite.js
const sqlite3 = require('sqlite3').verbose();

/**
 * Executes a SQL query that modifies the database.
 * @param {string} dbFile - Path to the database file.
 * @param {string} query - SQL query to execute.
 * @param {Array} [params=[]] - Query parameters.
 * @returns {Promise<Object>} - Query execution metadata.
 */
function executeQuery(dbFile, query, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbFile, handleError(reject, 'Error connecting to the database'));

        db.run(query, params, function (err) {
            if (err) return handleError(reject, 'Error executing query')(err);
            resolve({ lastID: this.lastID }); // Return last inserted ID
        });

        db.close(handleError(reject, 'Error closing the database connection', true));
    });
}

/**
 * Executes a SQL SELECT query and returns the results.
 * @param {string} dbFile - Path to the database file.
 * @param {string} query - SQL query to execute.
 * @param {Array} [params=[]] - Query parameters.
 * @returns {Promise<Array>} - Array of rows from the query.
 */
function executeSelectQuery(dbFile, query, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbFile, handleError(reject, 'Error connecting to the database'));

        db.all(query, params, (err, rows) => {
            if (err) return handleError(reject, 'Error executing SELECT query')(err);
            resolve(rows);
        });

        db.close(handleError(reject, 'Error closing the database connection', true));
    });
}

/**
 * Creates a standardized error handler.
 * @param {Function} reject - Promise rejection callback.
 * @param {string} message - Error message to log.
 * @param {boolean} [logSuccess=false] - Whether to log successful operations.
 * @returns {Function} - Error handler function.
 */
function handleError(reject, message, logSuccess = false) {
    return (err) => {
        if (err) {
            console.error(message, err.message);
            reject(err);
        } else if (logSuccess) {
            console.log('Operation completed successfully.');
        }
    };
}

module.exports = { executeQuery, executeSelectQuery };
