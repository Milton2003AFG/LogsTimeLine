// Aquí guardamos todo el estado global de la app
const appState = {
    events: [],
    loadedFiles: [],
    selectedFiles: [],
    currentFilter: '',
    currentSort: 'asc',
    currentLevel: 'tod',
    currentId: '',
    searchCommand: {
        type: null,
        value: ''
    },
    currentPage: 1,
    eventsPerPage: 100 // Paginación: Mostrar 100 eventos por página
};

async function init() {
    try {
        if (typeof Neutralino === 'undefined') {
            console.error('Neutralino no está cargado. Asegúrate de ejecutar "neu update" primero.');
            // Mostramos el error de forma visual
            showInitializationError();
            return;
        }
        await Neutralino.init();
        console.log('Neutralino inicializado correctamente');
        setupEventListeners();
        updateStats();
        // Ocultar paginación al inicio
        renderPaginationControls(0, 1);
    } catch (error) {
        console.error('Error al inicializar:', error);
        showInitializationError('Error al inicializar la aplicación: ' + error.message);
    }
}

// Muestra el error crítico si Neutralino no carga
function showInitializationError(customMessage = '') {
    const defaultTitle = "⚠️ Error de Configuración";
    const defaultMsg = "La biblioteca de Neutralino no está cargada.";
    const instructions = "Por favor ejecuta los siguientes comandos:";
    const commands = "cd mi-app\nneu update\nneu run";

    // Intentamos usar el modal de notificación si existe
    if (typeof showNotificationModal === 'function' && translations) {
        const lang = localStorage.getItem('language') || 'es';
        const t = translations[lang].errorConfig ? translations[lang] : translations['es'];
        
        showNotificationModal(
            `${t.errorConfig}\n\n` +
            `${customMessage || t.errorNeutralino}\n\n` +
            `${t.errorInstructions}\n` +
            `neu update`
        );
    } else {
        // Fallback a un body.innerHTML si todo lo demás falla
        document.body.innerHTML = `<div style="padding: 40px; text-align: center; font-family: sans-serif; color: #f8fafc;">` +
            `<h1 style="color: #ef4444;">${defaultTitle}</h1>` +
            `<p style="font-size: 18px; margin: 20px 0;">${customMessage || defaultMsg}</p>` +
            `<p style="font-size: 16px; color: #94a3b8;">${instructions}</p>` +
            `<pre style="background: #1e293b; padding: 20px; border-radius: 8px; text-align: left; max-width: 600px; margin: 20px auto; border: 1px solid #334155;">` +
            commands +
            '</pre>' +
            '</div>';
    }
}


// Conectamos todos los botones, inputs y selectores a sus funciones
function setupEventListeners() {
    const loadBtn = document.getElementById('loadFileBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    const exportBtn = document.getElementById('exportJsonBtn');
    const helpBtn = document.getElementById('helpBtn');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const sortOrder = document.getElementById('sortOrder');
    const levelSelect = document.getElementById('sortLevel');
    const sortId = document.getElementById('sortId');
    const selectAllFilesBtn = document.getElementById('selectAllFilesBtn');
    const deselectAllFilesBtn = document.getElementById('deselectAllFilesBtn');
    const helpBtnClose = document.getElementById('helpBtnClose');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            console.log('Botón de cargar presionado');
            await openFileDialog();
        });
    }
    
    if (clearBtn) { 
        clearBtn.addEventListener('click', clearAll); 
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportToJson);
    }

    if (helpBtn) {
        helpBtn.addEventListener('click', showHelpModal);
    }
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', triggerSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSearch();
            }
        });
    }

    if (sortOrder) { 
        sortOrder.addEventListener('change', handleSort); 
    }
    
    if (levelSelect) { 
        levelSelect.addEventListener('change', handleLevelFilter); 
    }
    
    if (sortId) { 
        sortId.addEventListener('change', handleSortId); 
    }

    if (selectAllFilesBtn) {
        selectAllFilesBtn.addEventListener('click', selectAllFiles);
    }

    if (deselectAllFilesBtn) {
        deselectAllFilesBtn.addEventListener('click', deselectAllFiles);
    }

    if (helpBtnClose) {
        helpBtnClose.addEventListener('click', hideHelpModal);
    }

    // Listeners de Paginación 
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            goToPage(appState.currentPage - 1);
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            goToPage(appState.currentPage + 1);
        });
    }
    // Fin Listeners de Paginación 

    try {
        Neutralino.events.on('windowClose', () => {
            Neutralino.app.exit();
        });
    } catch (error) {
        console.error('Error al configurar eventos de Neutralino:', error);
    }
}

// Revisa si el texto de búsqueda usa un comando (ID:, MSG:, NIVEL:)
function parseSearchCommand(searchText) {
    const trimmed = searchText.trim();
    
    const idMatch = trimmed.match(/^ID:\s*(\d+)/i);
    if (idMatch) {
        return { type: 'ID', value: idMatch[1] };
    }
    
    const msgMatch = trimmed.match(/^MSG:\s*(.+)/i);
    if (msgMatch) {
        return { type: 'MSG', value: msgMatch[1].trim() };
    }
    
    const nivelMatch = trimmed.match(/^NIVEL:\s*(\w+)/i);
    if (nivelMatch) {
        return { type: 'NIVEL', value: nivelMatch[1].toLowerCase() };
    }
    
    // Si no hay comando, es una búsqueda de texto normal
    return { type: null, value: trimmed };
}

// Devuelve los eventos que coinciden con todos los filtros activos
function getFilteredEvents() {
    return appState.events.filter(event => {
        // Si hay archivos cargados pero ninguno seleccionado, no mostramos nada.
        if (appState.loadedFiles.length > 0) {
            if (appState.selectedFiles.length === 0) {
                return false; 
            }
            // El evento no pertenece a un archivo seleccionado
            if (!appState.selectedFiles.includes(event.source)) {
                return false; 
            }
        }

        // Aplicamos el filtro de búsqueda (comando o texto)
        if (appState.searchCommand.value) {
            switch (appState.searchCommand.type) {
                case 'ID':
                    if (!event.eventId || !event.eventId.toString().includes(appState.searchCommand.value)) {
                        return false;
                    }
                    break;
                
                case 'MSG':
                    if (!event.message.toLowerCase().includes(appState.searchCommand.value.toLowerCase())) {
                        return false;
                    }
                    break;
                
                case 'NIVEL':
                    // Mapeamos posibles valores en español/inglés al valor interno
                    const nivelMap = {
                        'error': 'error',
                        'warning': 'warning',
                        'advertencia': 'warning',
                        'info': 'info',
                        'información': 'info',
                        'informacion': 'info',
                        'critical': 'critical',
                        'crítico': 'critical',
                        'critico': 'critical',
                        'detailed': 'detailed',
                        'detallado': 'detailed'
                    };
                    const targetLevel = nivelMap[appState.searchCommand.value];
                    if (!targetLevel || event.level !== targetLevel) {
                        return false;
                    }
                    break;
                
                default: // Búsqueda de texto normal
                    if (!event.message.toLowerCase().includes(appState.searchCommand.value.toLowerCase())) {
                        return false;
                    }
                    break;
            }
        }
        
        // Aplicamos el filtro del selector de Nivel
        if (appState.currentLevel && appState.currentLevel !== 'tod') {
            const levelMap = {
                adv: 'warning', cri: 'critical', err: 'error',
                inf: 'info', det: 'detailed' 
            };
            const mapped = levelMap[appState.currentLevel];

            if (appState.currentLevel === 'det') {
                // 'Detallado' es un caso especial, puede ser 'detailed' o 'null' (sin nivel)
                if (event.level !== 'detailed' && event.level !== null) {
                    return false;
                }
            } else if (mapped) {
                 if (event.level !== mapped) return false;
            }
        }
        return true; // Si pasó todos los filtros, ¡se muestra!
    });
}

async function openFileDialog() {
    console.log('Abriendo diálogo de archivo...');
    try {
        if (!Neutralino || !Neutralino.os) {
            throw new Error('Neutralino.os no está disponible');
        }
        const selection = await Neutralino.os.showOpenDialog('Selecciona uno o más archivos de log', {
            multiSelections: true,
            filters: [
                { name: 'txt, log, xml, json', extensions: ['txt', 'log', 'xml', 'json'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });

        console.log('Archivos seleccionados:', selection);

        if (selection && selection.length > 0) {
            // Limpiamos la búsqueda anterior al cargar nuevos archivos
            appState.searchCommand = { type: null, value: '' };
            appState.currentPage = 1; // Reseteamos paginación
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }

            for (const filePath of selection) {
                await loadFile(filePath);
            }
            
            updateFilesPanel();
        } else {
            console.log('No se seleccionó ningún archivo');
        }
    } catch (error) {
        console.error('Error al abrir el diálogo:', error);
        showNotificationModal('Error al seleccionar el archivo:\n\n' + error.message);
    }
}

// Carga un archivo, lo parsea y lo añade al estado global
async function loadFile(filePath) {
    const fileName = filePath.split(/[\\/]/).pop();

    // Evitamos cargar el mismo archivo dos veces
    if (appState.loadedFiles.includes(fileName)) {
        console.warn(`El archivo ${fileName} ya está cargado. Omitiendo.`);
        showNotificationModal(`El archivo ${fileName} ya está cargado.`);
        return;
    }

    showLoading(true);
    try {
        const content = await Neutralino.filesystem.readFile(filePath);
        const extension = fileName.split('.').pop().toLowerCase();

        // La magia del parseo ocurre en 'parsers.js'
        const events = parseLogContent(content, extension, fileName);

        if (events.length === 0) {
            console.warn('No se encontraron eventos con fechas válidas en el archivo.');
        }
        
        appState.events.push(...events);
        appState.loadedFiles.push(fileName);
        appState.selectedFiles.push(fileName); // El nuevo archivo se selecciona por defecto
        
        // Usamos requestAnimationFrame para no bloquear el UI después de cargar
        requestAnimationFrame(() => {
            renderTimeline();
            updateStats();
        });
        
        console.log(`Cargados ${events.length} eventos desde ${fileName}.`);
    } catch (error) {
        console.error('Error al cargar el archivo:', error);
        showNotificationModal('Error al cargar el archivo: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Dibuja la lista de archivos en la barra lateral
function updateFilesPanel() {
    const filesSidebar = document.getElementById('filesSidebar');
    const filesList = document.getElementById('filesList');

    if (!filesSidebar || !filesList) return;

    if (appState.loadedFiles.length === 0) {
        filesSidebar.classList.add('hidden');
        return;
    }

    filesSidebar.classList.remove('hidden');
    
    // Usar un DocumentFragment es mucho más rápido que añadir al DOM en bucle
    const fragment = document.createDocumentFragment();

    appState.loadedFiles.forEach(fileName => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `file-${fileName}`;
        checkbox.className = 'file-checkbox';
        checkbox.checked = appState.selectedFiles.includes(fileName);
        
        checkbox.addEventListener('change', (e) => {
            handleFileCheckboxChange(fileName, e.target.checked);
        });

        const label = document.createElement('label');
        label.htmlFor = `file-${fileName}`;
        label.className = 'file-label';
        
        const eventCount = appState.events.filter(e => e.source === fileName).length;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = fileName;
        
        const countSpan = document.createElement('span');
        countSpan.className = 'file-count';
        countSpan.textContent = `${eventCount}`;

        label.appendChild(nameSpan);
        label.appendChild(countSpan);
        
        fileItem.appendChild(checkbox);
        fileItem.appendChild(label);
        fragment.appendChild(fileItem);
    });

    filesList.innerHTML = ''; // Limpiamos la lista
    filesList.appendChild(fragment); // Añadimos todo de golpe
}

function handleFileCheckboxChange(fileName, isChecked) {
    if (isChecked) {
        if (!appState.selectedFiles.includes(fileName)) {
            appState.selectedFiles.push(fileName);
        }
    } else {
        appState.selectedFiles = appState.selectedFiles.filter(f => f !== fileName);
    }
    
    appState.currentPage = 1; // Reseteamos paginación
    
    // Pedimos al navegador que renderice en el próximo ciclo
    requestAnimationFrame(() => {
        renderTimeline();
        updateStats();
    });
}

function selectAllFiles() {
    appState.selectedFiles = [...appState.loadedFiles];
    appState.currentPage = 1; // Reseteamos paginación
    updateFilesPanel();
    requestAnimationFrame(() => {
        renderTimeline();
        updateStats();
    });
}

function deselectAllFiles() {
    appState.selectedFiles = [];
    appState.currentPage = 1; // Reseteamos paginación
    updateFilesPanel();
    requestAnimationFrame(() => {
        renderTimeline();
        updateStats();
    });
}

// Dibuja todos los eventos filtrados y ordenados en la línea de tiempo
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');

    const filteredEvents = getFilteredEvents();
    const totalFilteredCount = filteredEvents.length;

    if (totalFilteredCount === 0) {
        timeline.classList.remove('visible');
        emptyState.classList.remove('hidden');
        document.getElementById('eventsCount').textContent = appState.events.length;
        document.getElementById('visibleEventsCount').textContent = 0;
        renderPaginationControls(0, 1); // Ocultar paginación
        return;
    }

    // --- Lógica de Paginación ---
    const totalPages = Math.ceil(totalFilteredCount / appState.eventsPerPage);
    if (appState.currentPage > totalPages) {
        appState.currentPage = totalPages;
    }
    
    const startIndex = (appState.currentPage - 1) * appState.eventsPerPage;
    const endIndex = appState.currentPage * appState.eventsPerPage;
    // --- Fin Lógica de Paginación ---


    const sortedEvents = [...filteredEvents].sort((a, b) => {
        // El ordenamiento por ID tiene prioridad
        if (appState.currentId !== '') {
            const idA = a.id !== null && a.id !== undefined ? a.id : -1;
            const idB = b.id !== null && b.id !== undefined ? b.id : -1;
            
            if (idA === -1 && idB !== -1) return 1;
            if (idA !== -1 && idB === -1) return -1;
            
            if (appState.currentId === 'asc') {
                return idA - idB;
            } else {
                return idB - idA;
            }
        }
        
        // Si no, ordenamos por fecha
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        if (dateA === 0 && dateB !== 0) return 1;
        if (dateA !== 0 && dateB === 0) return -1;
        return appState.currentSort === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // --- Paginación: Cortamos los eventos a mostrar ---
    const pageEvents = sortedEvents.slice(startIndex, endIndex);
    // --- Fin Paginación ---

    // Usamos un DocumentFragment para optimizar el renderizado
    const fragment = document.createDocumentFragment();
    
    pageEvents.forEach(event => {
        const eventElement = createEventElement(event);
        fragment.appendChild(eventElement);
    });

    timeline.innerHTML = '';
    timeline.appendChild(fragment);

    // Actualizamos stats visibles (visibleEventsCount ahora se actualiza en updateStats)
    updateStats(); // Asegurarnos de que las stats están al día
    renderPaginationControls(totalFilteredCount, totalPages); // Dibujar controles de paginación

    timeline.classList.add('visible');
    emptyState.classList.add('hidden');
    
    // Scroll al inicio de la línea de tiempo
    timeline.scrollTop = 0;
}

// --- Nueva Función: Controlar paginación ---
function goToPage(pageNumber) {
    const filteredEvents = getFilteredEvents();
    const totalPages = Math.ceil(filteredEvents.length / appState.eventsPerPage);

    // Validar límites de página
    if (pageNumber < 1) {
        pageNumber = 1;
    }
    if (pageNumber > totalPages) {
        pageNumber = totalPages;
    }

    if (pageNumber !== appState.currentPage) {
        appState.currentPage = pageNumber;
        requestAnimationFrame(() => renderTimeline());
    }
}

// --- Nueva Función: Dibujar controles de paginación ---
function renderPaginationControls(totalFilteredCount, totalPages) {
    const controls = document.getElementById('paginationControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');

    if (totalFilteredCount <= appState.eventsPerPage) {
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');

    // Actualizar texto de info (usando traducciones si están disponibles)
    const lang = localStorage.getItem('language') || 'es';
    let pageInfoText = `Página ${appState.currentPage} de ${totalPages}`;
    if (typeof translations !== 'undefined' && translations[lang] && translations[lang].pageInfo) {
        pageInfoText = translations[lang].pageInfo
            .replace('{currentPage}', appState.currentPage)
            .replace('{totalPages}', totalPages);
    }
    pageInfo.textContent = pageInfoText;


    // Habilitar/deshabilitar botones
    prevBtn.disabled = (appState.currentPage === 1);
    nextBtn.disabled = (appState.currentPage === totalPages);
}


// Construye el HTML para una sola tarjeta de evento
function createEventElement(event) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'timeline-event';

    const timeSpan = document.createElement('div');
    timeSpan.className = 'event-time';
    timeSpan.textContent = formatDate(event.date); 

    const card = document.createElement('div');
    card.className = `event-card event-card-collapsible ${event.level ? 'event-level-' + event.level : 'event-level-default'}`;

    const summaryView = document.createElement('div');
    summaryView.className = 'event-summary';

    if (event.level) {
        const levelBadge = document.createElement('span');
        levelBadge.className = `log-level ${event.level}`;
        levelBadge.textContent = event.level;
        summaryView.appendChild(levelBadge);
    } else {
        // Ponemos un badge invisible para mantener la alineación
        const levelBadge = document.createElement('span');
        levelBadge.className = `log-level log-level-none`;
        levelBadge.innerHTML = '&nbsp;';
        levelBadge.style.visibility = "hidden";
        summaryView.appendChild(levelBadge);
    }

    const summaryMessage = document.createElement('span');
    summaryMessage.className = 'event-summary-message';
    
    // Mostramos solo la primera línea o 150 caracteres en el resumen
    const maxLen = 150;
    let messageText = event.message.split('\n')[0];
    
    if (messageText.length > maxLen) {
        messageText = messageText.substring(0, maxLen) + '...';
    }
    // Corregido: chequear si está vacío DESPUÉS de trim
    if (messageText.trim().length === 0) {
        messageText = '(Mensaje vacío, haga clic para ver detalles)';
    }
    summaryMessage.textContent = messageText;
    summaryView.appendChild(summaryMessage);
    
    const detailView = document.createElement('div');
    detailView.className = 'event-detail hidden'; // El detalle empieza oculto

    const source = document.createElement('div');
    source.className = 'event-source';
    source.innerHTML = `📄 <strong>Archivo:</strong> ${escapeHtml(event.source)}`;
    detailView.appendChild(source);

    if (event.eventId) {
        const eventIdDiv = document.createElement('div');
        eventIdDiv.className = 'event-source';
        eventIdDiv.innerHTML = `🔢 <strong>Event ID:</strong> ${escapeHtml(event.eventId.toString())}`;
        detailView.appendChild(eventIdDiv);
    }

    const message = document.createElement('div');
    message.className = 'event-message-detail';
    message.innerHTML = '<strong>Mensaje Completo:</strong>';
    
    // Usamos <pre> para respetar los saltos de línea y espacios
    const preMessage = document.createElement('pre');
    preMessage.textContent = event.message;
    message.appendChild(preMessage);
    
    detailView.appendChild(message);

    card.appendChild(summaryView);
    card.appendChild(detailView);

    // Hacemos que la tarjeta sea clickeable para mostrar/ocultar el detalle
    card.addEventListener('click', () => {
        detailView.classList.toggle('hidden');
        card.classList.toggle('is-open');
    });

    eventDiv.appendChild(timeSpan);
    eventDiv.appendChild(card);

    return eventDiv;
}

async function exportToJson() {
    if (appState.events.length === 0) {
        showNotificationModal('No hay eventos para exportar. Carga archivos primero.');
        return;
    }

    try {
        showLoading(true);

        // Solo exportamos los eventos que están actualmente filtrados
        const filteredEvents = getFilteredEvents();

        if (filteredEvents.length === 0) {
            showLoading(false);
            showNotificationModal('No hay eventos que coincidan con los filtros actuales.');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            totalEvents: filteredEvents.length,
            filters: {
                searchCommand: appState.searchCommand.type ? 
                    `${appState.searchCommand.type}:${appState.searchCommand.value}` : 
                    appState.searchCommand.value || 'ninguno',
                selectedFiles: appState.selectedFiles.length > 0 ? appState.selectedFiles : 'todos',
                level: appState.currentLevel !== 'tod' ? appState.currentLevel : 'todos',
                sortOrder: appState.currentSort,
                sortId: appState.currentId || 'ninguno'
            },
            sourceFiles: appState.loadedFiles,
            events: filteredEvents.map(event => ({
                date: event.date ? event.date.toISOString() : null,
                dateFormatted: formatDate(event.date),
                message: event.message,
                source: event.source,
                level: event.level || 'sin nivel',
                eventId: event.eventId || 'sin ID',
                id: event.id || 'sin ID'
            }))
        };

        const jsonContent = JSON.stringify(exportData, null, 2);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const defaultFileName = `timeline-export-${timestamp}.json`;

        const savePath = await Neutralino.os.showSaveDialog('Guardar línea de tiempo como JSON', {
            defaultPath: defaultFileName,
            filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });

        if (savePath) {
            // Aseguramos que el archivo tenga la extensión .json
            const finalPath = savePath.toLowerCase().endsWith('.json') ? savePath : savePath + '.json';
            await Neutralino.filesystem.writeFile(finalPath, jsonContent);
            
            showLoading(false);
            console.log(`Exportación exitosa: ${filteredEvents.length} eventos guardados en ${finalPath}`);
            
            showNotificationModal(
                `✅ Exportación exitosa!\n\n${filteredEvents.length} eventos guardados en:\n${finalPath}`
            );

        } else {
            showLoading(false);
            console.log('Exportación cancelada por el usuario');
        }

    } catch (error) {
        showLoading(false);
        console.error('Error al exportar:', error);
        showNotificationModal(`❌ Error al exportar:\n\n${error.message}`);
    }
}

// Un helper simple para mostrar las fechas de forma amigable
function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return "Fecha Desconocida"; 
    }
    const options = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    };
    return date.toLocaleString('es-ES', options);
}

// Pequeña utilidad de seguridad para evitar XSS al mostrar texto
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    document.getElementById('filesCount').textContent = appState.loadedFiles.length;
    document.getElementById('eventsCount').textContent = appState.events.length;
    
    // Las estadísticas de "visibles" y "rango" se basan en los filtros
    const filteredEvents = getFilteredEvents();
    document.getElementById('visibleEventsCount').textContent = filteredEvents.length;

    if (filteredEvents.length > 0) {
        const validDates = filteredEvents
            .map(e => e.date)
            .filter(d => d && !isNaN(d.getTime())) // Ignoramos fechas inválidas
            .map(d => d.getTime());

        if (validDates.length > 0) {
            const minDate = new Date(Math.min(...validDates));
            const maxDate = new Date(Math.max(...validDates));
            const dateRange = `${formatDate(minDate)} - ${formatDate(maxDate)}`;
            document.getElementById('dateRange').textContent = dateRange;
        } else {
            document.getElementById('dateRange').textContent = 'Rango no disponible';
        }
    } else {
        document.getElementById('dateRange').textContent = '-';
    }
}

function triggerSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchText = searchInput.value;
    
    // Guardamos el comando parseado en el estado
    appState.searchCommand = parseSearchCommand(searchText);
    appState.currentPage = 1; // Reseteamos paginación
    
    console.log('Comando parseado:', appState.searchCommand);
    requestAnimationFrame(() => renderTimeline());
}

function handleSort(e) {
    appState.currentSort = e.target.value; 
    appState.currentPage = 1; // Reseteamos paginación
    requestAnimationFrame(() => renderTimeline());
}

function handleLevelFilter(e) {
    appState.currentLevel = e.target.value;
    appState.currentPage = 1; // Reseteamos paginación
    requestAnimationFrame(() => renderTimeline());
}

function handleSortId(e) {
    appState.currentId = e.target.value;
    appState.currentPage = 1; // Reseteamos paginación
    requestAnimationFrame(() => renderTimeline());
}

function clearAll() {
    if (appState.events.length === 0) return;
    
    // Pedimos confirmación antes de borrar
    showConfirmationModal('¿Estás seguro de que deseas borrar todos los eventos y archivos?', () => {
        performClearAll();
    });
}

// Esta es la función que realmente borra todo, llamada después de confirmar
function performClearAll() {
    appState.events = [];
    appState.loadedFiles = [];
    appState.selectedFiles = [];
    appState.searchCommand = { type: null, value: '' };
    appState.currentId = '';
    appState.currentPage = 1; // Reseteamos paginación
    
    if (document.getElementById('searchInput')) {
        document.getElementById('searchInput').value = '';
    }
    
    updateFilesPanel();
    renderTimeline(); // Esto mostrará el estado vacío
    updateStats();
    renderPaginationControls(0, 1); // Ocultar paginación
}

function showHelpModal() {
    const overlay = document.getElementById('helpOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function hideHelpModal() {
    const overlay = document.getElementById('helpOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Muestra un pop-up simple con un mensaje y un botón de "Aceptar"
function showNotificationModal(message) {
    const overlay = document.getElementById('notificationOverlay');
    const msgElement = document.getElementById('notificationMessage');
    const okBtn = document.getElementById('notificationBtnOk');

    if (!overlay || !msgElement || !okBtn) {
        console.error('Elementos del modal de notificación no encontrados.');
        alert(message);
        return;
    }

    msgElement.textContent = message;
    overlay.classList.remove('hidden');

    // Clonamos el botón para limpiar listeners antiguos
    const newOkBtn = okBtn.cloneNode(true);
    // Aplicar traducción al botón si existe
    const lang = localStorage.getItem('language') || 'es';
    if (typeof translations !== 'undefined' && translations[lang] && translations[lang].notificationOk) {
        newOkBtn.textContent = translations[lang].notificationOk;
    }
    
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
    });
}

// Muestra un pop-up con "Sí" y "No" y ejecuta un callback si se confirma
function showConfirmationModal(message, onConfirm) {
    const overlay = document.getElementById('confirmOverlay');
    const msgElement = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmBtnYes');
    const noBtn = document.getElementById('confirmBtnNo');

    if (!overlay || !msgElement || !yesBtn || !noBtn) {
        console.error('Elementos del modal de confirmación no encontrados.');
        if (confirm(message)) { // Fallback a confirm nativo (puede no funcionar)
            onConfirm();
        }
        return;
    }

    // Aplicar traducciones si están disponibles
    const lang = localStorage.getItem('language') || 'es';
    if (typeof translations !== 'undefined' && translations[lang]) {
        msgElement.textContent = message; // El mensaje viene como argumento
        // Podríamos tener una key 'confirmMessageDefault' si quisiéramos
        yesBtn.textContent = translations[lang].confirmYes || 'Sí, borrar';
        noBtn.textContent = translations[lang].confirmNo || 'Cancelar';
    } else {
         msgElement.textContent = message;
    }
    
    overlay.classList.remove('hidden');

    // Re-creamos los botones para evitar listeners duplicados
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    const newNoBtn = noBtn.cloneNode(true);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    newYesBtn.addEventListener('click', () => {
        hideConfirmationModal();
        onConfirm(); // Ejecutamos la acción de "Sí"
    });

    newNoBtn.addEventListener('click', () => {
        hideConfirmationModal(); // El "No" solo cierra el modal
    });
}

function hideConfirmationModal() {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Activa o desactiva la pantalla de carga (spinner)
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// Nos aseguramos de que el DOM esté listo antes de ejecutar 'init'
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}