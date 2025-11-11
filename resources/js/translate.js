// Sistema de traducción ES/EN

const translations = {
    es: {
        // Header
        mainTitle: "📊 Visor de Línea de Tiempo de Logs de Windows",
        loadFileBtn: "📁 Cargar Archivo de Log",
        clearAllBtn: "🗑️ Limpiar Todo",
        
        // Stats
        filesLoaded: "Archivos cargados:",
        totalEvents: "Total de eventos:",
        dateRange: "Rango de fechas:",
        
        // Filters
        searchLabel: "🔍 Buscar en mensajes:",
        searchPlaceholder: "Filtrar por texto...",
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
        lowToHigh: "De menor a mayor",
        highToLow: "De mayor a menor",
        
        // Empty state
        emptyTitle: "No hay eventos cargados",
        emptyText: "Haz clic en \"Cargar Archivo de Log\" para comenzar",
        
        // Loading
        loadingText: "Procesando archivo...",
        
        // Confirmation modal
        confirmMessage: "¿Estás seguro?",
        confirmYes: "Sí, borrar",
        confirmNo: "Cancelar",
        
        // Error messages
        errorConfig: "⚠️ Error de Configuración",
        errorNeutralino: "La biblioteca de Neutralino no está cargada.",
        errorInstructions: "Por favor ejecuta los siguientes comandos:",
        
        // Image alt
        translateAlt: "traducir"
    },
    en: {
        // Header
        mainTitle: "📊 Windows Log Timeline Viewer",
        loadFileBtn: "📁 Load Log File",
        clearAllBtn: "🗑️ Clear All",
        
        // Stats
        filesLoaded: "Files loaded:",
        totalEvents: "Total events:",
        dateRange: "Date range:",
        
        // Filters
        searchLabel: "🔍 Search in messages:",
        searchPlaceholder: "Filter by text...",
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
        lowToHigh: "Low to high",
        highToLow: "High to low",
        
        // Empty state
        emptyTitle: "No events loaded",
        emptyText: "Click \"Load Log File\" to start",
        
        // Loading
        loadingText: "Processing file...",
        
        // Confirmation modal
        confirmMessage: "Are you sure?",
        confirmYes: "Yes, delete",
        confirmNo: "Cancel",
        
        // Error messages
        errorConfig: "⚠️ Configuration Error",
        errorNeutralino: "Neutralino library is not loaded.",
        errorInstructions: "Please run the following commands:",
        
        // Image alt
        translateAlt: "translate"
    }
};

// Idioma actual (por defecto español)
let currentLang = localStorage.getItem('language') || 'es';

// Función para traducir la página
function translatePage(lang) {
    const t = translations[lang];
    
    // Header
    document.querySelector('h1').textContent = t.mainTitle;
    document.getElementById('loadFileBtn').textContent = t.loadFileBtn;
    document.getElementById('clearAllBtn').textContent = t.clearAllBtn;
    
    // Stats labels
    document.querySelectorAll('.stat-label')[0].textContent = t.filesLoaded;
    document.querySelectorAll('.stat-label')[1].textContent = t.totalEvents;
    document.querySelectorAll('.stat-label')[2].textContent = t.dateRange;
    
    // Filters
    document.querySelector('label[for="searchInput"]').textContent = t.searchLabel;
    document.getElementById('searchInput').placeholder = t.searchPlaceholder;
    document.querySelector('label[for="sortLevel"]').textContent = t.sortLevelLabel;
    document.querySelector('label[for="sortOrder"]').textContent = t.sortDateLabel;
    document.querySelector('label[for="sortId"]').textContent = t.sortIdLabel;
    
    // Select options - sortLevel
    const sortLevel = document.getElementById('sortLevel');
    sortLevel.options[0].text = t.allLevels;
    sortLevel.options[1].text = t.warning;
    sortLevel.options[2].text = t.critical;
    sortLevel.options[3].text = t.error;
    sortLevel.options[4].text = t.detailed;
    sortLevel.options[5].text = t.information;
    
    // Select options - sortOrder
    const sortOrder = document.getElementById('sortOrder');
    sortOrder.options[0].text = t.oldestFirst;
    sortOrder.options[1].text = t.newestFirst;
    
    // Select options - sortId
    const sortId = document.getElementById('sortId');
    sortId.options[0].text = t.noFilter;
    sortId.options[1].text = t.lowToHigh;
    sortId.options[2].text = t.highToLow;
    
    // Empty state
    document.querySelector('#emptyState h2').textContent = t.emptyTitle;
    document.querySelector('#emptyState p').textContent = t.emptyText;
    
    // Loading overlay
    document.querySelector('#loadingOverlay p').textContent = t.loadingText;
    
    // Confirmation modal
    document.getElementById('confirmMessage').textContent = t.confirmMessage;
    document.getElementById('confirmBtnYes').textContent = t.confirmYes;
    document.getElementById('confirmBtnNo').textContent = t.confirmNo;
    
    // Image alt del botón traducir
    document.querySelector('#translate img').alt = t.translateAlt;
    
    // Guardar preferencia
    localStorage.setItem('language', lang);
}

// Inicializar traducción cuando el DOM esté listo
function initTranslation() {
    // Aplicar idioma guardado
    translatePage(currentLang);
    
    // Evento del botón de traducción
    document.getElementById('translate').addEventListener('click', function() {
        currentLang = currentLang === 'es' ? 'en' : 'es';
        translatePage(currentLang);
    });
}

// Ejecutar cuando el DOM esté cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslation);
} else {
    initTranslation();
}