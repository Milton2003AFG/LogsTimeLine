// Este archivo maneja todo el sistema de traducción ES/EN.
// Contiene el objeto de traducciones y la lógica para cambiar el idioma.

const translations = {
    es: {
        // Header
        mainTitle: "📊 Visor de Línea de Tiempo de Logs de Windows",
        loadFileBtn: "📁 Cargar Archivo de Log",
        exportJsonBtn: "💾 Exportar a JSON",
        helpBtn: "❓ Comandos de Búsqueda",
        clearAllBtn: "🗑️ Limpiar Todo",
        
        // Stats
        filesLoaded: "Archivos cargados:",
        totalEvents: "Total de eventos:",
        visibleEvents: "Eventos visibles:",
        dateRange: "Rango de fechas:",
        
        // Filters
        searchLabel: "🔍 Buscar (ID, MSG, MSG, TEXTO):",
        searchPlaceholder: "Escribe aquí o usa comandos",
        sortLevelLabel: "Ordenar por Nivel de Evento:",
        sortDateLabel: "Ordenar por Fecha:",
        sortIdLabel: "Ordenar por ID:",
        
        // Select options
        allLevels: "Todos",
        warning: "Advertencia",
        critical: "Crítico",
        error: "Error",
        detailed: "Detallado",
        information: "Información",
        oldestFirst: "Más antiguo primero",
        newestFirst: "Más reciente primero",
        noFilter: "Sin filtro",
        ascending: "Ascendente",
        descending: "Descendente",
        
        // Sidebar
        sidebarTitle: "📂 Archivos",
        selectAllFiles: "Seleccionar todos",
        deselectAllFiles: "Deseleccionar todos",
        
        // Help Modal
        helpTitle: "📖 Comandos de Búsqueda",
        helpDescription: "Puedes usar estos comandos en la barra de búsqueda:",
        helpCommandId: "ID:1000",
        helpCommandIdDesc: "Buscar por Event ID específico",
        helpCommandMsg: "MSG:error conexión",
        helpCommandMsgDesc: "Buscar texto en mensajes",
        helpCommandLevel: "NIVEL:error",
        helpCommandLevelDesc: "Filtrar por nivel (error, warning, info, critical, detailed)",
        helpCommandNormal: "texto normal",
        helpCommandNormalDesc: "Sin comando, busca en todos los mensajes",
        helpExamplesTitle: "Ejemplos:",
        helpExample1: "ID:4624",
        helpExample1Desc: "Eventos con ID 4624",
        helpExample2: "MSG:failed login",
        helpExample2Desc: "Mensajes con \"failed login\"",
        helpExample3: "NIVEL:critical",
        helpExample3Desc: "Solo eventos críticos",
        helpCloseBtn: "Cerrar",
        
        // Empty state
        emptyTitle: "No hay eventos cargados",
        emptyText: "Haz clic en \"Cargar Archivo de Log\" para comenzar",
        
        // Loading
        loadingText: "Procesando archivo...",
        
        // Confirmation modal
        confirmMessage: "¿Estás seguro?",
        confirmYes: "Sí, borrar",
        confirmNo: "Cancelar",
        
        // Notification modal
        notificationOk: "Aceptar",
        
        // Error messages
        errorConfig: "⚠️ Error de Configuración",
        errorNeutralino: "La biblioteca de Neutralino no está cargada.",
        errorInstructions: "Por favor ejecuta los siguientes comandos:",
        
        // Pagination
        prevPage: "‹‹ Anteriores",
        nextPage: "Siguientes ››",
        pageInfo: "Página {currentPage} de {totalPages}", // {currentPage} y {totalPages} serán reemplazados
        
        // Image alt
        translateAlt: "traducir"
    },
    en: {
        // Header
        // SOLUCIÓN: Eliminados los espacios en blanco extra
        mainTitle: "📊 Windows Log Timeline Viewer", 
        loadFileBtn: "📁 Load Log File",
        exportJsonBtn: "💾 Export to JSON",
        helpBtn: "❓ Search Commands",
        clearAllBtn: "🗑️ Clear All",
        
        // Stats
        filesLoaded: "Files loaded:",
        totalEvents: "Total events:",
        visibleEvents: "Visible events:",
        dateRange: "Date range:",
        
        // Filters
        searchLabel: "🔍 Search (ID, MSG, LEVEL, TEXT):",
        searchPlaceholder: "Type here or use commands...",
        sortLevelLabel: "Sort by Event Level:",
        sortDateLabel: "Sort by Date:",
        sortIdLabel: "Sort by ID:",
        
        // Select options
        allLevels: "All",
        warning: "Warning",
        critical: "Critical",
        error: "Error",
        detailed: "Detailed",
        information: "Information",
        oldestFirst: "Oldest first",
        newestFirst: "Newest first",
        noFilter: "No filter",
        ascending: "Ascending",
        descending: "Descending",
        
        // Sidebar
        sidebarTitle: "📂 Files",
        selectAllFiles: "Select all",
        deselectAllFiles: "Deselect all",
        
        // Help Modal
        helpTitle: "📖 Search Commands",
        helpDescription: "You can use these commands in the search bar:",
        helpCommandId: "ID:1000",
        helpCommandIdDesc: "Search by specific Event ID",
        helpCommandMsg: "MSG:error connection",
        helpCommandMsgDesc: "Search text in messages",
        helpCommandLevel: "LEVEL:error",
        helpCommandLevelDesc: "Filter by level (error, warning, info, critical, detailed)",
        helpCommandNormal: "normal text",
        helpCommandNormalDesc: "Without command, searches in all messages",
        helpExamplesTitle: "Examples:",
        helpExample1: "ID:4624",
        helpExample1Desc: "Events with ID 4624",
        helpExample2: "MSG:failed login",
        helpExample2Desc: "Messages with \"failed login\"",
        helpExample3: "LEVEL:critical",
        helpExample3Desc: "Only critical events",
        helpCloseBtn: "Close",
        
        // Empty state
        emptyTitle: "No events loaded",
        emptyText: "Click \"Load Log File\" to start",
        
        // Loading
        loadingText: "Processing file...",
        
        // Confirmation modal
        confirmMessage: "Are you sure?",
        confirmYes: "Yes, delete",
        confirmNo: "Cancel",
        
        // Notification modal
        notificationOk: "Accept",
        
        // Error messages
        errorConfig: "⚠️ Configuration Error",
        errorNeutralino: "Neutralino library is not loaded.",
        errorInstructions: "Please run the following commands:",
        
        // Pagination
        prevPage: "‹‹ Previous",
        nextPage: "Next ››",
        pageInfo: "Page {currentPage} of {totalPages}",
        
        // Image alt
        translateAlt: "translate"
    }
};

// Guardamos el idioma actual aquí. Por defecto 'es', o el que esté en localStorage.
let currentLang = localStorage.getItem('language') || 'es';

// Esta función se encarga de buscar todos los elementos por ID o selector
// y cambiar su texto al idioma seleccionado.
function translatePage(lang) {
    const t = translations[lang];
    
    // Header
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = t.mainTitle;
    
    const loadBtn = document.getElementById('loadFileBtn');
    if (loadBtn) loadBtn.innerHTML = t.loadFileBtn;
    
    const exportBtn = document.getElementById('exportJsonBtn');
    if (exportBtn) exportBtn.innerHTML = t.exportJsonBtn;
    
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) helpBtn.innerHTML = t.helpBtn;
    
    const clearBtn = document.getElementById('clearAllBtn');
    if (clearBtn) clearBtn.innerHTML = t.clearAllBtn;
    
    // Etiquetas de la barra de estadísticas
    const statLabels = document.querySelectorAll('.stat-label');
    if (statLabels[0]) statLabels[0].textContent = t.filesLoaded;
    if (statLabels[1]) statLabels[1].textContent = t.totalEvents;
    if (statLabels[2]) statLabels[2].textContent = t.visibleEvents;
    if (statLabels[3]) statLabels[3].textContent = t.dateRange;
    
    // Sección de filtros
    const searchLabel = document.querySelector('label[for="searchInput"]');
    if (searchLabel) searchLabel.textContent = t.searchLabel;
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = t.searchPlaceholder;
    
    const sortLevelLabel = document.querySelector('label[for="sortLevel"]');
    if (sortLevelLabel) sortLevelLabel.textContent = t.sortLevelLabel;
    
    const sortOrderLabel = document.querySelector('label[for="sortOrder"]');
    if (sortOrderLabel) sortOrderLabel.textContent = t.sortDateLabel;
    
    const sortIdLabel = document.querySelector('label[for="sortId"]');
    if (sortIdLabel) sortIdLabel.textContent = t.sortIdLabel;
    
    // Opciones del select 'sortLevel'
    const sortLevel = document.getElementById('sortLevel');
    if (sortLevel && sortLevel.options.length >= 6) {
        sortLevel.options[0].text = t.allLevels;
        sortLevel.options[1].text = t.warning;
        sortLevel.options[2].text = t.critical;
        sortLevel.options[3].text = t.error;
        sortLevel.options[4].text = t.detailed;
        sortLevel.options[5].text = t.information;
    }
    
    // Opciones del select 'sortOrder'
    const sortOrder = document.getElementById('sortOrder');
    if (sortOrder && sortOrder.options.length >= 2) {
        sortOrder.options[0].text = t.oldestFirst;
        sortOrder.options[1].text = t.newestFirst;
    }
    
    // Opciones del select 'sortId'
    const sortId = document.getElementById('sortId');
    if (sortId && sortId.options.length >= 3) {
        sortId.options[0].text = t.noFilter;
        sortId.options[1].text = t.ascending;
        sortId.options[2].text = t.descending;
    }
    
    // Barra lateral de archivos
    const sidebarTitle = document.querySelector('.sidebar-header h3');
    if (sidebarTitle) sidebarTitle.textContent = t.sidebarTitle;
    
    const selectAllBtn = document.getElementById('selectAllFilesBtn');
    if (selectAllBtn) selectAllBtn.title = t.selectAllFiles;
    
    const deselectAllBtn = document.getElementById('deselectAllFilesBtn');
    if (deselectAllBtn) deselectAllBtn.title = t.deselectAllFiles;
    
    // Modal de ayuda
    const helpModalTitle = document.querySelector('.help-modal h2');
    if (helpModalTitle) helpModalTitle.textContent = t.helpTitle;
    
    const helpModalDesc = document.querySelector('.help-modal > p');
    if (helpModalDesc) helpModalDesc.textContent = t.helpDescription;
    
    const helpCommands = document.querySelectorAll('.help-command');
    if (helpCommands.length >= 4) {
        // Comando ID
        const idStrong = helpCommands[0].querySelector('strong');
        const idSpan = helpCommands[0].querySelector('span');
        if (idStrong) idStrong.textContent = t.helpCommandId;
        if (idSpan) idSpan.textContent = t.helpCommandIdDesc;
        
        // Comando MSG
        const msgStrong = helpCommands[1].querySelector('strong');
        const msgSpan = helpCommands[1].querySelector('span');
        if (msgStrong) msgStrong.textContent = t.helpCommandMsg;
        if (msgSpan) msgSpan.textContent = t.helpCommandMsgDesc;
        
        // Comando NIVEL
        const nivelStrong = helpCommands[2].querySelector('strong');
        const nivelSpan = helpCommands[2].querySelector('span');
        if (nivelStrong) nivelStrong.textContent = t.helpCommandLevel;
        if (nivelSpan) nivelSpan.textContent = t.helpCommandLevelDesc;
        
        // Texto normal
        const normalStrong = helpCommands[3].querySelector('strong');
        const normalSpan = helpCommands[3].querySelector('span');
        if (normalStrong) normalStrong.textContent = t.helpCommandNormal;
        if (normalSpan) normalSpan.textContent = t.helpCommandNormalDesc;
    }
    
    const helpExamplesTitle = document.querySelector('.help-examples h3');
    if (helpExamplesTitle) helpExamplesTitle.textContent = t.helpExamplesTitle;
    
    const helpExamples = document.querySelectorAll('.help-examples li');
    if (helpExamples.length >= 3) {
        // Ejemplo 1
        const ex1Code = helpExamples[0].querySelector('code');
        if (ex1Code) {
            const textAfterCode = helpExamples[0].childNodes[2];
            if (ex1Code) ex1Code.textContent = t.helpExample1;
            if (textAfterCode) textAfterCode.textContent = ` - ${t.helpExample1Desc}`;
        }
        
        // Ejemplo 2
        const ex2Code = helpExamples[1].querySelector('code');
        if (ex2Code) {
            const textAfterCode = helpExamples[1].childNodes[2];
            if (ex2Code) ex2Code.textContent = t.helpExample2;
            if (textAfterCode) textAfterCode.textContent = ` - ${t.helpExample2Desc}`;
        }
        
        // Ejemplo 3
        const ex3Code = helpExamples[2].querySelector('code');
        if (ex3Code) {
            const textAfterCode = helpExamples[2].childNodes[2];
            if (ex3Code) ex3Code.textContent = t.helpExample3;
            if (textAfterCode) textAfterCode.textContent = ` - ${t.helpExample3Desc}`;
        }
    }
    
    const helpCloseBtn = document.getElementById('helpBtnClose');
    if (helpCloseBtn) helpCloseBtn.textContent = t.helpCloseBtn;
    
    // Textos para cuando la línea de tiempo está vacía
    const emptyTitle = document.querySelector('#emptyState h2');
    if (emptyTitle) emptyTitle.textContent = t.emptyTitle;
    
    const emptyText = document.querySelector('#emptyState p');
    if (emptyText) emptyText.textContent = t.emptyText;
    
    // Pantalla de carga
    const loadingText = document.querySelector('#loadingOverlay p');
    if (loadingText) loadingText.textContent = t.loadingText;
    
    // Modal de confirmación (ej. borrar todo)
    const confirmMessage = document.getElementById('confirmMessage');
    if (confirmMessage) {
        // No sobreescribir el mensaje si fue puesto dinámicamente
        // confirmMessage.textContent = t.confirmMessage; 
    }
    
    const confirmYes = document.getElementById('confirmBtnYes');
    if (confirmYes) confirmYes.textContent = t.confirmYes;
    
    const confirmNo = document.getElementById('confirmBtnNo');
    if (confirmNo) confirmNo.textContent = t.confirmNo;
    
    // Modal de notificación
    const notificationOk = document.getElementById('notificationBtnOk');
    if (notificationOk) notificationOk.textContent = t.notificationOk;
    
    // --- Paginación ---
    const prevPageBtn = document.getElementById('prevPageBtn');
    if (prevPageBtn) prevPageBtn.textContent = t.prevPage;
    
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (nextPageBtn) nextPageBtn.textContent = t.nextPage;
    
    // El texto de pageInfo se actualiza dinámicamente en main.js
    // para incluir los números de página.
    
    // Texto alternativo de la imagen del botón de traducir
    const translateImg = document.querySelector('#translate img');
    if (translateImg) translateImg.alt = t.translateAlt;
    
    // Guardamos el idioma elegido en localStorage para la próxima visita
    localStorage.setItem('language', lang);

    // Volver a renderizar la paginación con el texto nuevo si es necesario
    if (typeof renderPaginationControls !== 'undefined' && typeof appState !== 'undefined') {
        const totalFilteredCount = getFilteredEvents ? getFilteredEvents().length : 0;
        const totalPages = Math.ceil(totalFilteredCount / appState.eventsPerPage) || 1;
        renderPaginationControls(totalFilteredCount, totalPages);
    }
}

// Configura los listeners para el sistema de traducción
function initTranslation() {
    // Aplicamos el idioma que esté guardado al cargar
    translatePage(currentLang);
    
    // Asignamos el evento al botón de traducir
    const translateBtn = document.getElementById('translate');
    if (translateBtn) {
        translateBtn.addEventListener('click', function() {
            // Cambia entre 'es' y 'en'
            currentLang = currentLang === 'es' ? 'en' : 'es';
            translatePage(currentLang);
        });
    }
}

// Nos aseguramos de que el DOM esté listo antes de intentar traducir
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslation);
} else {
    initTranslation();
}