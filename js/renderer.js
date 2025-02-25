// Utility function to initialize a DataTable
function initializeDataTable({ notebook, tableId, columnHeaderMapping, tableData, rowIdKey }) {
    const tableElement = $(`#${tableId}`);
    
    // Destroy any existing DataTable instance
    if ($.fn.DataTable.isDataTable(tableElement)) {
        tableElement.DataTable().destroy();
        tableElement.empty();
    } else if (!tableElement.length) {
        const newTable = document.createElement("table");
        newTable.id = tableId;
        document.body.appendChild(newTable);
    }

    const columns = [
        ...Object.keys(columnHeaderMapping).map(key => ({
            data: key,
            title: columnHeaderMapping[key]
        })),
        {
            data: null,
            orderable: false,
            render: (data, type, row) => `
                <button class="edit-button noselect" onclick="event.stopPropagation();showNoteEditor('${notebook}','${row[rowIdKey]}')" title="Edit Note">🖉</button>
                <button class="delete-button noselect" onclick="event.stopPropagation();deleteNote('${notebook}','${row[rowIdKey]}')" title="Delete Note">✕</button>
            `
        } //event.stopPropagation();initializeEditor('${row[rowIdKey]}')
    ];

    const table = $(`#${tableId}`).DataTable({
        data: tableData,
        colReorder: true, // Enable column reordering by dragging
        fixedHeader: true, // Fix headers to the top of the screen
        paginate: false, // Disable pagination
        filter: false, // Disable additional filtering
        info: false, // Hide "Showing 1 of N Entries"
        keys: false, // Keyboard navigation of cells
        searching: true, // Enable table searching
        stateSave: true, // Enables automatic state saving of filters in localStorage
                         // ^---  Atomatically applies filters when the table gets reloaded
        searchPanes: {
            threshold: 1, // Minimum unique values to display search pane
            initCollapsed: true // Start with the search panes collapsed
        },
        layout: {
            top: 'searchPanes', // Left align search panes
            top2: 'search'
        },
        columns,
        createdRow: (row, data) => {
            if (data[rowIdKey]) $(row).attr('id', data[rowIdKey]);
        },
        columnDefs: [
            { targets: -1, width: "70px" },
            { targets: "_all", searchPanes: { className: "column-search-panes" } }
        ],
        initComplete: () => addTableHeaderButtons(tableId, columns, notebook)
    });

    // Add click event listener for row expansion
    $(`#${tableId} tbody`).on('click', 'tr', async function (event) {
        // Prevent action if click happens inside the details content
        if ($(event.target).closest('.note-content').length > 0) {
            return;
        }
    
        const row = table.row(this);
    
        if (row.child.isShown()) {
            // Hide child row if already shown
            row.child.hide();
            $(this).removeClass('shown');
        } else {
            // Show child row with fetched details
            const rowId = $(this).attr('id');
    
            const rawDetails = await BEGetNoteContent(notebook, rowId);
            const renderedDetails = window.markdownAPI.renderMarkdown(rawDetails);
            row.child(`<div class="note-content">${renderedDetails}</div>`).show();
            $(this).addClass('shown');
        }
    });

    return table;
}

// Add custom header buttons to the table
function addTableHeaderButtons(tableId, columns, notebook) {
    const tableHeader = $(`#${tableId} thead`);
    
    tableHeader.find('th').last().append(`
        <button class="new-button noselect" onclick="event.stopPropagation();showAddColumnEditor('${notebook}')" title="Add New Column">⋮</button>
        <button class="new-button noselect" onclick="event.stopPropagation();showAddNoteEditor('${notebook}')" title="Add New Note">⋯</button>
    `);

    tableHeader.find('th').each(function (index) {
        if (index < columns.length - 1) {
            const columnName = columns[index].title;
            /*
            $(this).append(`
                <div style="white-space:nowrap;margin-left:auto;margin-right:0;">
                    <button class="edit-button noselect" onclick="event.stopPropagation();showColumnNameEditor('${notebook}','${columnName}')">🖉</button>
                    <button class="delete-button noselect" onclick="event.stopPropagation();deleteColumn('${notebook}','${columnName}')">✕</button>
                </div>
            `);
            */
            $(this).append(`
                <button class="edit-button noselect" onclick="event.stopPropagation();showColumnNameEditor('${notebook}','${columnName}')" title="Edit Column">🖉</button>
                <button class="delete-button noselect" onclick="event.stopPropagation();deleteColumn('${notebook}','${columnName}')" title="Delete Column">✕</button>
            `);
        }
    });
}

// Hide redundant search bars
function hideSearchBars() {
    document.querySelectorAll('label[for^="dt-search-"]').forEach(label => {
        const id = label.getAttribute('for');
        if (parseInt(id.split('-')[2]) % 2 !== 0) label.style.display = "none";
    });

    document.querySelectorAll('input[id^="dt-search-"]').forEach(input => {
        const id = input.id;
        if (parseInt(id.split('-')[2]) % 2 !== 0) input.style.display = "none";
    });
}

// Update the main table
async function updateTable(notebook) {
    const tableId = "main-table"; //Hard coded in saveNewNote & deleteNote
    const [mapping, data, title] = await Promise.all([
        BEGetColumnNameMapping(notebook),
        BEGetAllNotes(notebook),
        BEGetTitle(notebook)
    ]);

    editTitle(title);
    initializeDataTable({
        notebook,
        tableId,
        columnHeaderMapping: mapping,
        tableData: data,
        rowIdKey: "_note_id"
    });

    hideSearchBars();

    console.log('Table updated successfully')
}

// Event Handlers
async function deleteColumn(notebook, columnName) {
    if (confirm(`Are you sure you want to delete the column "${columnName}"?`)) {
        await BEDeleteColumn(notebook, columnName);
        updateTable(notebook);
    }
}

async function deleteNote(notebook, noteId) {
    if (confirm("Are you sure you want to delete this note?")) {
        await BEDeleteNote(notebook, noteId);
        
        //updateTable(notebook);
        // Find and remove the row from the DataTable using the row ID
        $('#main-table').DataTable().row(`#${noteId}`).remove().draw(true);
    }
}

// Electron Event Listeners
window.electronAPI.on('initialize-new-file', async (notebook) => {
    console.log('Initializing new file:', notebook);
    try {
        await BECreateNewNotebook(notebook);
        await BEEditTitle(notebook, 'New Notebook');
        await BEAddColumn(notebook, 'New Column');
        //await BEAddNewNote(notebook, 'New Note Content', { 'New Column': 'New Note' });
        console.log('File initialized successfully');
    } catch (error) {
        console.error('Error initializing file:', error);
    }
    updateTable(notebook);

    document.getElementById('reload-btn').onclick = () => updateTable(notebook); // Add table reload button
    document.getElementById('title-edit-btn').onclick = () => showNotebookTitleEditor(notebook);
});

window.electronAPI.on('file-path-selected', (notebook) => {
    console.log('File path received:', notebook);
    updateTable(notebook);
    
    document.getElementById('reload-btn').onclick = () => updateTable(notebook); // Add table reload button
    // showNotebookTitleEditor(notebook)
    // () => showNotebookTitleEditor(notebook)
    document.getElementById('title-edit-btn').onclick = () => showNotebookTitleEditor(notebook);
});

// Miscellaneous
function editTitle(newTitle) {
    document.getElementById("main-heading").innerText = newTitle || "Untitled Notebook";
}

async function copyToClipboard(button, uniqueId) {
    navigator.clipboard.writeText(document.getElementById(uniqueId).innerText);
    button.textContent = "Copied!";
    setTimeout(function() {
        button.textContent = "Copy";
    }, 2000);
}


