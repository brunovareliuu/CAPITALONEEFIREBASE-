// Iconos intuitivos para categorías de gastos - organizados por tipo de gasto común con mayor variedad
export const predefinedIcons = [
  // Alimentación y Restaurantes (30+ iconos)
  'utensils', 'hamburger', 'pizza-slice', 'coffee', 'glass-martini', 'beer',
  'cookie-bite', 'ice-cream', 'bread-slice', 'carrot', 'apple-alt', 'lemon',
  'pepper-hot', 'drumstick-bite', 'fish', 'cheese', 'wine-glass', 'cocktail',
  'mug-hot', 'stroopwafel', 'birthday-cake', 'candy-cane', 'hotdog', 'seedling',
  'leaf', 'egg', 'bowl-food', 'concierge-bell', 'bread-loaf', 'pepper', 'onion',

  // Transporte (20+ iconos)
  'car', 'bus', 'subway', 'taxi', 'gas-pump', 'bicycle', 'motorcycle',
  'plane', 'train', 'ship', 'parking', 'truck', 'ambulance', 'fighter-jet',
  'rocket', 'tractor', 'tram', 'shuttle-van', 'motorcycle', 'truck-monster',

  // Entretenimiento (25+ iconos)
  'film', 'music', 'gamepad', 'tv', 'theater-masks', 'headphones',
  'camera', 'microphone', 'guitar', 'futbol', 'basketball-ball', 'table-tennis',
  'chess', 'dice', 'puzzle-piece', 'palette', 'paint-brush', 'skiing',
  'swimming-pool', 'bowling-ball', 'volleyball-ball', 'baseball-ball',
  'hockey-puck', 'quidditch', 'drum',

  // Compras y Tiendas (20+ iconos)
  'shopping-bag', 'shopping-cart', 'shoe-prints', 'gem',
  'mobile-alt', 'laptop', 'desktop', 'book', 'gift', 'ring', 'crown',
  'glasses', 'hat-wizard', 'socks', 'mitten', 'user-tie',
  'vest', 'umbrella', 'basketball-ball',

  // Servicios (25+ iconos)
  'cut', 'user-md', 'tooth', 'home', 'wrench', 'plug', 'wifi',
  'phone', 'envelope', 'university', 'building', 'hospital', 'school',
  'gavel', 'balance-scale', 'stethoscope', 'syringe', 'vial', 'dna',
  'microscope', 'scissors', 'briefcase', 'id-card', 'passport', 'key',

  // Salud y Bienestar (25+ iconos)
  'heartbeat', 'medkit', 'pills', 'stethoscope', 'user-md', 'weight',
  'running', 'dumbbell', 'spa', 'leaf', 'brain', 'eye', 'bone',
  'lungs', 'tooth', 'hand-holding-heart', 'first-aid', 'thermometer',
  'band-aid', 'clinic-medical', 'wheelchair', 'universal-access', 'blind', 'deaf',

  // Hogar y Familia (20+ iconos)
  'home', 'baby', 'paw', 'tree', 'lightbulb', 'bed', 'bath',
  'broom', 'paint-roller', 'hammer', 'couch', 'chair', 'toilet',
  'shower', 'sink', 'blender', 'utensils', 'dog', 'cat', 'fish',

  // Trabajo y Educación (20+ iconos)
  'briefcase', 'graduation-cap', 'book-open', 'laptop-code', 'calculator',
  'clipboard', 'file-alt', 'pen', 'marker', 'pencil-alt', 'ruler',
  'compass', 'flask', 'atom', 'book-reader', 'chalkboard-teacher',
  'user-graduate', 'school', 'university', 'certificate',

  // Viajes y Ocio (20+ iconos)
  'suitcase', 'umbrella-beach', 'map-marked-alt', 'mountain', 'swimmer',
  'hiking', 'camera-retro', 'binoculars', 'map-signs', 'route', 'plane',
  'helicopter', 'ship', 'anchor', 'compass', 'globe-americas',
  'globe-europe', 'globe-asia', 'campground', 'fire-alt',

  // Finanzas (20+ iconos)
  'wallet', 'credit-card', 'piggy-bank', 'coins', 'dollar-sign', 'euro-sign',
  'money-bill-wave', 'chart-line', 'balance-scale', 'landmark', 'university',
  'building', 'store', 'cash-register', 'receipt',
  'file-invoice-dollar', 'percentage', 'chart-bar', 'chart-pie',

  // Tecnología y Comunicación (20+ iconos)
  'mobile-alt', 'laptop', 'desktop', 'tablet-alt', 'keyboard', 'mouse',
  'wifi', 'signal', 'satellite-dish', 'sim-card', 'sd-card', 'hdd',
  'usb', 'plug', 'battery-half', 'camera', 'video', 'microphone',
  'headphones', 'volume-up',

  // Deportes y Recreación (25+ iconos)
  'futbol', 'basketball-ball', 'baseball-ball', 'volleyball-ball', 'football-ball',
  'table-tennis', 'bowling-ball', 'golf-ball', 'skiing', 'swimming-pool',
  'biking', 'running', 'dumbbell', 'weight', 'spa', 'hot-tub', 'snowboarding',
  'skating', 'hiking', 'mountain', 'campground', 'fire-alt', 'chess', 'dice',
  'puzzle-piece', 'gamepad', 'joystick', 'trophy', 'medal',

  // Otros comunes y variados (60+ iconos)
  'question-circle', 'star', 'heart', 'thumbs-up', 'lightbulb', 'bell',
  'calendar-alt', 'clock', 'map-marker-alt', 'tag', 'flag', 'bookmark',
  'paperclip', 'cut', 'copy', 'paste', 'undo', 'redo', 'search',
  'filter', 'sort', 'share-alt', 'download', 'upload', 'trash-alt',
  'edit', 'save', 'plus', 'minus', 'times', 'check', 'exclamation-triangle',
  'info-circle', 'exclamation-circle', 'check-circle', 'times-circle',
  'plus-circle', 'minus-circle', 'arrow-up', 'arrow-down', 'arrow-left',
  'arrow-right', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
  'angle-up', 'angle-down', 'angle-left', 'angle-right', 'caret-up', 'caret-down',
  'play', 'pause', 'stop', 'forward', 'backward', 'fast-forward', 'fast-backward',
  'step-forward', 'step-backward', 'eject', 'random', 'repeat', 'sync', 'sync-alt'
].filter((icon, index, self) => self.indexOf(icon) === index); // Quitar duplicados

// Iconos por defecto para categorías comunes
export const defaultCategoryIcons = {
  'Alimentación': 'utensils',
  'Transporte': 'car',
  'Entretenimiento': 'film',
  'Compras': 'shopping-bag',
  'Salud': 'heartbeat',
  'Hogar': 'home',
  'Trabajo': 'briefcase',
  'Viajes': 'suitcase',
  'Finanzas': 'wallet',
  'Educación': 'graduation-cap',
  'Deportes': 'futbol',
  'Tecnología': 'mobile-alt',
  'Ropa': 'shirt',
  'Restaurantes': 'utensils',
  'Supermercado': 'shopping-cart',
  'Gasolina': 'gas-pump',
  'Médico': 'user-md',
  'Farmacia': 'pills',
  'Entretenimiento': 'tv',
  'Suscripción': 'wifi',
  'Belleza': 'spa',
  'Mascotas': 'paw',
  'Familia': 'users',
  'Regalos': 'gift',
  'Seguros': 'shield-alt',
  'Impuestos': 'balance-scale',
  'Inversiones': 'chart-line',
  'Ahorros': 'piggy-bank',
  'Préstamos': 'hand-holding-usd',
  'Donaciones': 'donate',
  'Lotería': 'trophy',
  'Cine': 'film',
  'Conciertos': 'music',
  'Teatro': 'theater-masks',
  'Museos': 'university',
  'Parques': 'tree',
  'Gimnasio': 'dumbbell',
  'Internet': 'wifi',
  'Teléfono': 'phone',
  'Electricidad': 'bolt',
  'Agua': 'tint',
  'Gas': 'fire',
  'Limpieza': 'broom',
  'Reparaciones': 'wrench',
  'Jardín': 'leaf',
  'Muebles': 'couch'
};

export default { predefinedIcons };





