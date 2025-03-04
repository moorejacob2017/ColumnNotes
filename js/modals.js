// Utility to add CTRL+S functionality
function addCtrlSListener(modalId, saveFunction) {
    const keydownHandler = async (event) => {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            if (document.getElementById(modalId).classList.contains('active')) {
                await saveFunction();
            }
        }
    };

    // Attach the event listener
    document.addEventListener('keydown', keydownHandler);

    // Return a cleanup function to remove the listener when the modal is closed
    return () => document.removeEventListener('keydown', keydownHandler);
}

// Utility Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function clearInputs(inputSelector) {
    document.querySelectorAll(inputSelector).forEach(input => input.value = '');
}

// Function to Initialize Modal Buttons
function initModalButtons(modalHeaderId, onCancel, onSave) {
    const header = document.getElementById(modalHeaderId);
    header.innerHTML = ''; // Clear existing content

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = onCancel;

    const saveButton = document.createElement('button');
    saveButton.className = 'btn-save';
    saveButton.textContent = 'Save';
    saveButton.onclick = onSave;

    header.appendChild(cancelButton);
    header.appendChild(saveButton);
}

function handleCancelNoteEdit() {
    if (confirm('Are you sure you want to cancel? All inputs will be cleared.')) {
        clearInputs('.note-column-input');
        document.getElementById('input-note-content').value = '';
        hideNoteEditor();
    }
}

//======================================================================================
// Notebook Title Editor
async function showNotebookTitleEditor(notebook) {
    const titleTextbox = document.getElementById('input-notebook-title');
    titleTextbox.value = await BEGetTitle(notebook);

    initModalButtons('modal-notebook-title-editor-header', hideNotebookTitleEditor, () => saveNotebookTitle(notebook));
    showModal('modal-notebook-title-editor');

    // Add CTRL+S listener
    const removeCtrlSListener = addCtrlSListener('modal-notebook-title-editor', async () => saveNotebookTitle(notebook));
    titleTextbox.removeCtrlSListener = removeCtrlSListener;
}

function hideNotebookTitleEditor() {
    hideModal('modal-notebook-title-editor');
    const titleTextbox = document.getElementById('input-notebook-title');
    const removeCtrlSListener = titleTextbox.removeCtrlSListener; // Access the property
    if (removeCtrlSListener) {
        removeCtrlSListener(); // Call the cleanup function
        delete titleTextbox.removeCtrlSListener; // Clean up to avoid memory leaks
    }
}

async function saveNotebookTitle(notebook) {
    const newTitle = document.getElementById('input-notebook-title').value;
    await BEEditTitle(notebook, newTitle);
    await updateTable(notebook);
    hideNotebookTitleEditor();
}

//======================================================================================

// Column Name Editor
async function showColumnNameEditor(notebook, column) {
    const nameTextbox = document.getElementById('input-column-name');
    nameTextbox.value = column;

    initModalButtons('modal-column-name-editor-header', hideColumnNameEditor, () => saveColumnName(notebook, column));
    showModal('modal-column-name-editor');

    // Add CTRL+S listener
    const removeCtrlSListener = addCtrlSListener('modal-column-name-editor', async () => saveColumnName(notebook, column));
    nameTextbox.removeCtrlSListener = removeCtrlSListener;
}

// Add New Column Editor
async function showAddColumnEditor(notebook) {
    const nameTextbox = document.getElementById('input-column-name');
    nameTextbox.value = '';  // Clear any existing values

    initModalButtons('modal-column-name-editor-header', hideColumnNameEditor, () => saveNewColumnName(notebook));
    showModal('modal-column-name-editor');

    // Add CTRL+S listener
    const removeCtrlSListener = addCtrlSListener('modal-column-name-editor', async () => saveNewColumnName(notebook));
    nameTextbox.removeCtrlSListener = removeCtrlSListener;
}

function hideColumnNameEditor() {
    hideModal('modal-column-name-editor');
    const nameTextbox = document.getElementById('input-column-name');
    const removeCtrlSListener = nameTextbox.removeCtrlSListener;
    if (removeCtrlSListener) {
        removeCtrlSListener(); // Call the cleanup function
        delete nameTextbox.removeCtrlSListener; // Clean up to avoid memory leaks
    }
}

async function saveColumnName(notebook, column) {
    const newName = document.getElementById('input-column-name').value;
    await BERenameColumn(notebook, column, newName);
    await updateTable(notebook);
    hideColumnNameEditor();
}

async function saveNewColumnName(notebook) {
    const newName = document.getElementById('input-column-name').value;
    await BEAddColumn(notebook, newName);
    await updateTable(notebook);
    hideColumnNameEditor();
}

//======================================================================================

// Note Editor
async function showNoteEditor(notebook, noteID) {
    const noteTextbox = document.getElementById('input-note-content');
    const note = await BEGetNote(notebook, noteID);
    const { _note_id, _note_content, ...noteColumns } = note;

    initModalButtons('modal-note-editor-header', hideNoteEditor, () => saveNote(notebook, noteID));
    populateNoteColumns(noteColumns);
    document.getElementById('input-note-content').value = _note_content;

    showModal('modal-note-editor');

    // Add CTRL+S listener
    const removeCtrlSListener = addCtrlSListener('modal-note-editor', async () => saveNote(notebook, noteID));
    noteTextbox.removeCtrlSListener = removeCtrlSListener;
}

// Add New Note Editor
async function showAddNoteEditor(notebook) {
    const noteTextbox = document.getElementById('input-note-content');
    noteTextbox.value = '';  // Clear the note content

    initModalButtons('modal-note-editor-header', hideNoteEditor, () => saveNewNote(notebook));

    const columns = await BEGetColumns(notebook);
    const columnsDict = {};
    columns.forEach(item => {
        columnsDict[item] = '';
    });

    populateNoteColumns(columnsDict);  // Clear the columns for the new note
    showModal('modal-note-editor');

    // Add CTRL+S listener
    const removeCtrlSListener = addCtrlSListener('modal-note-editor', async () => saveNewNote(notebook));
    noteTextbox.removeCtrlSListener = removeCtrlSListener;
}

function hideNoteEditor() {
    hideModal('modal-note-editor');
    const noteTextbox = document.getElementById('input-note-content');
    const removeCtrlSListener = noteTextbox.removeCtrlSListener;
    if (removeCtrlSListener) {
        removeCtrlSListener(); // Call the cleanup function
        delete noteTextbox.removeCtrlSListener; // Clean up to avoid memory leaks
    }
}

function populateNoteColumns(columns) {
    const editorTop = document.getElementById('note-editor-upper');
    editorTop.innerHTML = ''; // Clear existing content

    Object.entries(columns).forEach(([key, value]) => {
        const container = document.createElement('div');
        container.className = 'note-column-container';

        const label = document.createElement('label');
        label.htmlFor = key;
        label.textContent = decodeColumnName(key);

        const input = document.createElement('input');
        input.className = 'note-column-input';
        input.id = key;
        input.type = 'text';
        input.value = value || '';

        container.appendChild(label);
        container.appendChild(input);
        editorTop.appendChild(container);
    });
}

async function saveNote(notebook, noteID) {
    var columns = Array.from(document.querySelectorAll('.note-column-input')).reduce((acc, input) => {
        acc[input.id] = input.value;
        return acc;
    }, {});

    const content = document.getElementById('input-note-content').value;

    await BEEditNoteColumn(notebook, noteID, columns);
    await BEEditNoteContent(notebook, noteID, content);

    //await updateTable(notebook);
    columns['_note_id'] = noteID;
    let table = $('#main-table').DataTable();
    let row = table.row(`#${noteID}`);

    row.data(columns).draw(true);

    // Check if the row is expanded and update its details
    if (row.child.isShown()) {
        const updatedDetails = await BEGetNoteContent(notebook, noteID);
        const renderedDetails = window.markdownAPI.renderMarkdown(updatedDetails);
        row.child(`<div class="note-content">${renderedDetails}</div>`).show();
    }

    clearInputs('.note-column-input');
    document.getElementById('input-note-content').value = '';
    hideNoteEditor();
}

async function saveNewNote(notebook) {
    var columns = Array.from(document.querySelectorAll('.note-column-input')).reduce((acc, input) => {
        acc[input.id] = input.value;
        return acc;
    }, {});

    const content = document.getElementById('input-note-content').value;

    // Add note to the backend and get the new note's ID
    const newNoteID = await BEAddNewNote(notebook, content, columns);

    columns['_note_id'] = newNoteID // Key:Value needed for the DataTables render to add id attr and buttons
    $('#main-table').DataTable().row.add(columns).draw(true); // Add the new row to table without data reload


    clearInputs('.note-column-input');
    document.getElementById('input-note-content').value = '';
    hideNoteEditor();
}

//======================================================================================


/*
async function saveNoteWithoutClosing(notebook, noteID) {
    const columns = Array.from(document.querySelectorAll('.note-column-input')).reduce((acc, input) => {
        acc[input.id] = input.value;
        return acc;
    }, {});

    const content = document.getElementById('input-note-content').value;

    await BEEditNoteColumn(notebook, noteID, columns);
    await BEEditNoteContent(notebook, noteID, content);
    await updateTable(notebook);
}
*/

/*
// Keyboard Shortcuts
function handleKeyboardShortcuts(event) {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        event.shiftKey ? saveNoteWithoutClosing() : saveNote();
    } else if (event.key === 'Escape') {
        handleCancelNoteEdit();
    }
}

// Event Listener Initialization
window.onload = function () {
    document.addEventListener('keydown', handleKeyboardShortcuts);
};
*/