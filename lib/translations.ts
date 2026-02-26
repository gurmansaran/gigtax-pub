/**
 * Translation System
 * Provides EN/ES translations for all user-facing strings.
 * Mexican/Latin American Spanish for US-based gig workers.
 */

export type Language = 'en' | 'es';

const translations: Record<Language, Record<string, string>> = {
  en: {
    // ========================================================================
    // Language Selection Screen
    // ========================================================================
    'language.headline.en': 'Choose your language',
    'language.headline.es': 'Elige tu idioma',
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.continue': 'Continue',

    // ========================================================================
    // Login Screen
    // ========================================================================
    'login.title': 'Welcome Back',
    'login.subtitle': 'Log in to continue tracking your earnings',
    'login.email.label': 'Email',
    'login.email.placeholder': 'you@example.com',
    'login.password.label': 'Password',
    'login.password.placeholder': 'Enter your password',
    'login.forgotPassword': 'Forgot Password?',
    'login.button': 'Log In',
    'login.noAccount': "Don't have an account?",
    'login.signUp': 'Sign Up',
    'login.error.emailRequired': 'Please enter your email address.',
    'login.error.emailInvalid': 'Please enter a valid email address.',
    'login.error.passwordRequired': 'Please enter your password.',
    'login.error.invalidCredentials': 'Invalid email or password. Please try again.',
    'login.error.emailNotConfirmed': 'Please check your email and confirm your account before logging in.',
    'login.error.tooManyRequests': 'Too many login attempts. Please wait a moment and try again.',
    'login.error.network': 'Network error. Please check your connection and try again.',
    'login.error.generic': 'An error occurred during login.',
    'login.error.title': 'Login Failed',
    'login.forgotPassword.enterEmail': 'Please enter your email address above, then tap "Forgot Password?" again.',
    'login.forgotPassword.enterEmailTitle': 'Enter Email',
    'login.forgotPassword.success': 'If an account exists with this email, you will receive a password reset link.',
    'login.forgotPassword.successTitle': 'Check Your Email',
    'login.forgotPassword.error': 'Failed to send reset email. Please try again.',

    // ========================================================================
    // Signup Screen
    // ========================================================================
    'signup.title': 'Create Account',
    'signup.subtitle': 'Start tracking your gig earnings and taxes',
    'signup.email.label': 'Email',
    'signup.email.placeholder': 'you@example.com',
    'signup.password.label': 'Password',
    'signup.password.placeholder': 'Minimum 8 characters',
    'signup.confirmPassword.label': 'Confirm Password',
    'signup.confirmPassword.placeholder': 'Re-enter your password',
    'signup.confirmPassword.error': 'Passwords do not match',
    'signup.button': 'Create Account',
    'signup.terms': 'By creating an account, you agree to our',
    'signup.termsOfService': 'Terms of Service',
    'signup.and': 'and',
    'signup.privacyPolicy': 'Privacy Policy',
    'signup.hasAccount': 'Already have an account?',
    'signup.logIn': 'Log In',
    'signup.error.emailRequired': 'Please enter your email address.',
    'signup.error.emailInvalid': 'Please enter a valid email address.',
    'signup.error.passwordRequired': 'Please enter a password.',
    'signup.error.passwordTooShort': 'Password must be at least 8 characters long.',
    'signup.error.passwordMismatch': 'Passwords do not match.',
    'signup.error.alreadyRegistered': 'An account with this email already exists. Try logging in instead.',
    'signup.error.invalidEmail': 'Please check your email address and try again.',
    'signup.error.network': 'Network error. Please check your connection and try again.',
    'signup.error.generic': 'An error occurred during sign up.',
    'signup.error.title': 'Sign Up Failed',
    'signup.strength.weak': 'Weak',
    'signup.strength.fair': 'Fair',
    'signup.strength.good': 'Good',
    'signup.strength.strong': 'Strong',

    // ========================================================================
    // Onboarding - General
    // ========================================================================
    'onboarding.step': 'Step',
    'onboarding.of': 'of',
    'onboarding.continue': 'Continue',
    'onboarding.back': 'Back',
    'onboarding.skip': 'Skip for Now',
    'onboarding.saveFailed': 'Save Failed',
    'onboarding.saveFailedMessage': 'Failed to save. Please try again.',
    'onboarding.error': 'Error',

    // ========================================================================
    // Onboarding Step 1 - Name
    // ========================================================================
    'onboarding.step1.title': "What's your name?",
    'onboarding.step1.subtitle': "We'll use this for your tax documents",
    'onboarding.step1.firstName.label': 'First Name',
    'onboarding.step1.firstName.placeholder': 'John',
    'onboarding.step1.lastName.label': 'Last Name',
    'onboarding.step1.lastName.placeholder': 'Doe',
    'onboarding.step1.error.firstName': 'Please enter your first name (at least 2 characters).',
    'onboarding.step1.error.lastName': 'Please enter your last name (at least 2 characters).',

    // ========================================================================
    // Onboarding Step 2 - Phone
    // ========================================================================
    'onboarding.step2.title': "What's your phone number?",
    'onboarding.step2.subtitle': "We'll use this to send you important tax reminders",
    'onboarding.step2.phone.label': 'Phone Number',
    'onboarding.step2.phone.placeholder': '(555) 123-4567',
    'onboarding.step2.error.phone': 'Please enter a valid 10-digit phone number.',

    // ========================================================================
    // Onboarding Step 3 - Address
    // ========================================================================
    'onboarding.step3.title': "What's your home address?",
    'onboarding.step3.subtitle': 'Used for tax filing and to track trips starting from home',
    'onboarding.step3.address.label': 'Address',
    'onboarding.step3.address.placeholder': 'Start typing your address...',
    'onboarding.step3.selectedAddress': 'Selected Address:',
    'onboarding.step3.error.address': 'Please select an address from the suggestions.',
    'onboarding.step3.error.incomplete': 'City, state, and ZIP code are required. Please select a complete address from the suggestions.',
    'onboarding.step3.error.incompleteTitle': 'Incomplete Address',

    // ========================================================================
    // Onboarding Step 4 - Tax Info
    // ========================================================================
    'onboarding.step4.title': 'Tax Information',
    'onboarding.step4.subtitle': 'We need your date of birth for tax calculations',
    'onboarding.step4.dob.label': 'Date of Birth *',
    'onboarding.step4.dob.placeholder': 'MM/DD/YYYY',
    'onboarding.step4.ssn.label': 'Social Security Number (Optional)',
    'onboarding.step4.ssn.placeholder': 'XXX-XX-XXXX',
    'onboarding.step4.ssn.skip': "Skip for now — I'll add it later",
    'onboarding.step4.ssn.skipped': 'SSN skipped — you can add it later in Settings',
    'onboarding.step4.ssn.undo': 'Undo',
    'onboarding.step4.error.dob': 'Please enter a valid date of birth.',
    'onboarding.step4.error.dobFormat': 'Please enter date as MM/DD/YYYY',
    'onboarding.step4.error.dobMonth': 'Invalid month',
    'onboarding.step4.error.dobDay': 'Invalid day',
    'onboarding.step4.error.dobYear': 'Invalid year',
    'onboarding.step4.error.dobAge': 'You must be at least 18 years old',
    'onboarding.step4.error.ssn': 'Please enter a valid 9-digit SSN or skip for now.',

    // ========================================================================
    // Onboarding Step 5 - Gig Platforms
    // ========================================================================
    'onboarding.step5.title': 'Which platforms do you drive for?',
    'onboarding.step5.subtitle': "Select all that apply. We'll help you track earnings from each.",
    'onboarding.step5.error.noPlatform': 'Please select at least one platform you drive for.',

    // ========================================================================
    // Onboarding Step 6 - Bank Link
    // ========================================================================
    'onboarding.step6.title': 'Connect Your Bank',
    'onboarding.step6.subtitle': 'Automatically track income and expenses from your bank account.',
    'onboarding.step6.benefit1': 'Auto-import transactions daily',
    'onboarding.step6.benefit2': 'Categorize income and expenses automatically',
    'onboarding.step6.benefit3': 'Never manually enter a transaction again',
    'onboarding.step6.success': 'Bank connected successfully!',

    // ========================================================================
    // Onboarding Step 7 - Paywall
    // ========================================================================
    'onboarding.step7.title': 'Get Premium Features',
    'onboarding.step7.freePlan': 'Free Plan',
    'onboarding.step7.price': '$0/year',
    'onboarding.step7.priceSubtext': 'Pay only if you want pro review ($49)',
    'onboarding.step7.feature1': 'Unlimited tax returns',
    'onboarding.step7.feature2': 'File for you and spouse',
    'onboarding.step7.feature3': 'AI-powered deduction finder',
    'onboarding.step7.feature4': 'Quarterly tax reminders',
    'onboarding.step7.feature5': 'Audit support',
    'onboarding.step7.continueButton': 'Continue with Free Plan',

    // ========================================================================
    // Tab Bar
    // ========================================================================
    'tabs.home': 'Home',
    'tabs.insights': 'Insights',
    'tabs.expenses': 'Expenses',
    'tabs.earnings': 'Earnings',
    'tabs.fileNow': 'File Now',
    'tabs.settings': 'Settings',

    // ========================================================================
    // Settings Screen
    // ========================================================================
    'settings.title': 'Settings',
    'settings.account': 'Account',
    'settings.profile': 'Profile',
    'settings.manageSubscription': 'Manage Subscription',
    'settings.upgradeToPro': 'Upgrade to Pro',
    'settings.appearance': 'Appearance',
    'settings.system': 'System',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.preferences': 'Preferences',
    'settings.hapticFeedback': 'Haptic Feedback',
    'settings.tax': 'Tax',
    'settings.taxReturns': 'Tax Returns',
    'settings.mileageTracking': 'Mileage Tracking',
    'settings.bankConnections': 'Bank Connections',
    'settings.support': 'Support',
    'settings.helpSupport': 'Help & Support',
    'settings.helpMessage': 'Contact us at support@gigtax.app for assistance.',
    'settings.about': 'About',
    'settings.aboutMessage': 'Version 1.0.0\nTax filing made simple for gig workers.',
    'settings.logOut': 'Log Out',
    'settings.logOutConfirm': 'Are you sure you want to log out?',
    'settings.cancel': 'Cancel',
    'settings.language': 'Language / Idioma',
    'settings.languageModalTitle': 'Select Language / Seleccionar idioma',

    // ========================================================================
    // App Entry / Loading
    // ========================================================================
    'app.loading.timeout': 'Loading took too long. Please check your connection.',
    'app.loading.retry': 'Retry',
    'app.error.accountStatus': 'Failed to check account status. Please try again.',

    // ========================================================================
    // Common / Shared
    // ========================================================================
    'common.error': 'Error',
    'common.ok': 'OK',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.done': 'Done',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.loading': 'Loading...',
    'common.success': 'Success',
  },

  es: {
    // ========================================================================
    // Language Selection Screen
    // ========================================================================
    'language.headline.en': 'Choose your language',
    'language.headline.es': 'Elige tu idioma',
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.continue': 'Continuar',

    // ========================================================================
    // Login Screen
    // ========================================================================
    'login.title': 'Bienvenido de nuevo',
    'login.subtitle': 'Inicia sesión para seguir rastreando tus ganancias',
    'login.email.label': 'Correo electrónico',
    'login.email.placeholder': 'tu@ejemplo.com',
    'login.password.label': 'Contraseña',
    'login.password.placeholder': 'Ingresa tu contraseña',
    'login.forgotPassword': '¿Olvidaste tu contraseña?',
    'login.button': 'Iniciar sesión',
    'login.noAccount': '¿No tienes una cuenta?',
    'login.signUp': 'Regístrate',
    'login.error.emailRequired': 'Por favor ingresa tu correo electrónico.',
    'login.error.emailInvalid': 'Por favor ingresa un correo electrónico válido.',
    'login.error.passwordRequired': 'Por favor ingresa tu contraseña.',
    'login.error.invalidCredentials': 'Correo o contraseña inválidos. Por favor intenta de nuevo.',
    'login.error.emailNotConfirmed': 'Por favor revisa tu correo y confirma tu cuenta antes de iniciar sesión.',
    'login.error.tooManyRequests': 'Demasiados intentos. Por favor espera un momento e intenta de nuevo.',
    'login.error.network': 'Error de red. Por favor verifica tu conexión e intenta de nuevo.',
    'login.error.generic': 'Ocurrió un error al iniciar sesión.',
    'login.error.title': 'Error al iniciar sesión',
    'login.forgotPassword.enterEmail': 'Por favor ingresa tu correo electrónico arriba y luego toca "¿Olvidaste tu contraseña?" de nuevo.',
    'login.forgotPassword.enterEmailTitle': 'Ingresa tu correo',
    'login.forgotPassword.success': 'Si existe una cuenta con este correo, recibirás un enlace para restablecer tu contraseña.',
    'login.forgotPassword.successTitle': 'Revisa tu correo',
    'login.forgotPassword.error': 'No se pudo enviar el correo de restablecimiento. Por favor intenta de nuevo.',

    // ========================================================================
    // Signup Screen
    // ========================================================================
    'signup.title': 'Crear cuenta',
    'signup.subtitle': 'Comienza a rastrear tus ganancias e impuestos de trabajo independiente',
    'signup.email.label': 'Correo electrónico',
    'signup.email.placeholder': 'tu@ejemplo.com',
    'signup.password.label': 'Contraseña',
    'signup.password.placeholder': 'Mínimo 8 caracteres',
    'signup.confirmPassword.label': 'Confirmar contraseña',
    'signup.confirmPassword.placeholder': 'Vuelve a ingresar tu contraseña',
    'signup.confirmPassword.error': 'Las contraseñas no coinciden',
    'signup.button': 'Crear cuenta',
    'signup.terms': 'Al crear una cuenta, aceptas nuestros',
    'signup.termsOfService': 'Términos de servicio',
    'signup.and': 'y',
    'signup.privacyPolicy': 'Política de privacidad',
    'signup.hasAccount': '¿Ya tienes una cuenta?',
    'signup.logIn': 'Iniciar sesión',
    'signup.error.emailRequired': 'Por favor ingresa tu correo electrónico.',
    'signup.error.emailInvalid': 'Por favor ingresa un correo electrónico válido.',
    'signup.error.passwordRequired': 'Por favor ingresa una contraseña.',
    'signup.error.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres.',
    'signup.error.passwordMismatch': 'Las contraseñas no coinciden.',
    'signup.error.alreadyRegistered': 'Ya existe una cuenta con este correo. Intenta iniciar sesión.',
    'signup.error.invalidEmail': 'Por favor verifica tu correo electrónico e intenta de nuevo.',
    'signup.error.network': 'Error de red. Por favor verifica tu conexión e intenta de nuevo.',
    'signup.error.generic': 'Ocurrió un error al registrarte.',
    'signup.error.title': 'Error al registrarse',
    'signup.strength.weak': 'Débil',
    'signup.strength.fair': 'Regular',
    'signup.strength.good': 'Buena',
    'signup.strength.strong': 'Fuerte',

    // ========================================================================
    // Onboarding - General
    // ========================================================================
    'onboarding.step': 'Paso',
    'onboarding.of': 'de',
    'onboarding.continue': 'Continuar',
    'onboarding.back': 'Atrás',
    'onboarding.skip': 'Omitir por ahora',
    'onboarding.saveFailed': 'Error al guardar',
    'onboarding.saveFailedMessage': 'No se pudo guardar. Por favor intenta de nuevo.',
    'onboarding.error': 'Error',

    // ========================================================================
    // Onboarding Step 1 - Name
    // ========================================================================
    'onboarding.step1.title': '¿Cómo te llamas?',
    'onboarding.step1.subtitle': 'Usaremos esto para tus documentos de impuestos',
    'onboarding.step1.firstName.label': 'Nombre',
    'onboarding.step1.firstName.placeholder': 'Juan',
    'onboarding.step1.lastName.label': 'Apellido',
    'onboarding.step1.lastName.placeholder': 'García',
    'onboarding.step1.error.firstName': 'Por favor ingresa tu nombre (al menos 2 caracteres).',
    'onboarding.step1.error.lastName': 'Por favor ingresa tu apellido (al menos 2 caracteres).',

    // ========================================================================
    // Onboarding Step 2 - Phone
    // ========================================================================
    'onboarding.step2.title': '¿Cuál es tu número de teléfono?',
    'onboarding.step2.subtitle': 'Lo usaremos para enviarte recordatorios importantes de impuestos',
    'onboarding.step2.phone.label': 'Número de teléfono',
    'onboarding.step2.phone.placeholder': '(555) 123-4567',
    'onboarding.step2.error.phone': 'Por favor ingresa un número de teléfono válido de 10 dígitos.',

    // ========================================================================
    // Onboarding Step 3 - Address
    // ========================================================================
    'onboarding.step3.title': '¿Cuál es tu dirección?',
    'onboarding.step3.subtitle': 'Se usa para la declaración de impuestos y para rastrear viajes desde tu casa',
    'onboarding.step3.address.label': 'Dirección',
    'onboarding.step3.address.placeholder': 'Empieza a escribir tu dirección...',
    'onboarding.step3.selectedAddress': 'Dirección seleccionada:',
    'onboarding.step3.error.address': 'Por favor selecciona una dirección de las sugerencias.',
    'onboarding.step3.error.incomplete': 'Se requiere ciudad, estado y código postal. Por favor selecciona una dirección completa de las sugerencias.',
    'onboarding.step3.error.incompleteTitle': 'Dirección incompleta',

    // ========================================================================
    // Onboarding Step 4 - Tax Info
    // ========================================================================
    'onboarding.step4.title': 'Información fiscal',
    'onboarding.step4.subtitle': 'Necesitamos tu fecha de nacimiento para los cálculos de impuestos',
    'onboarding.step4.dob.label': 'Fecha de nacimiento *',
    'onboarding.step4.dob.placeholder': 'MM/DD/AAAA',
    'onboarding.step4.ssn.label': 'Número de Seguro Social (Opcional)',
    'onboarding.step4.ssn.placeholder': 'XXX-XX-XXXX',
    'onboarding.step4.ssn.skip': 'Omitir por ahora — lo agregaré después',
    'onboarding.step4.ssn.skipped': 'SSN omitido — puedes agregarlo después en Configuración',
    'onboarding.step4.ssn.undo': 'Deshacer',
    'onboarding.step4.error.dob': 'Por favor ingresa una fecha de nacimiento válida.',
    'onboarding.step4.error.dobFormat': 'Por favor ingresa la fecha como MM/DD/AAAA',
    'onboarding.step4.error.dobMonth': 'Mes inválido',
    'onboarding.step4.error.dobDay': 'Día inválido',
    'onboarding.step4.error.dobYear': 'Año inválido',
    'onboarding.step4.error.dobAge': 'Debes tener al menos 18 años',
    'onboarding.step4.error.ssn': 'Por favor ingresa un SSN válido de 9 dígitos u omite por ahora.',

    // ========================================================================
    // Onboarding Step 5 - Gig Platforms
    // ========================================================================
    'onboarding.step5.title': '¿En qué plataformas trabajas?',
    'onboarding.step5.subtitle': 'Selecciona todas las que apliquen. Te ayudaremos a rastrear las ganancias de cada una.',
    'onboarding.step5.error.noPlatform': 'Por favor selecciona al menos una plataforma en la que trabajes.',

    // ========================================================================
    // Onboarding Step 6 - Bank Link
    // ========================================================================
    'onboarding.step6.title': 'Conecta tu banco',
    'onboarding.step6.subtitle': 'Rastrea automáticamente ingresos y gastos desde tu cuenta bancaria.',
    'onboarding.step6.benefit1': 'Importar transacciones automáticamente cada día',
    'onboarding.step6.benefit2': 'Categorizar ingresos y gastos automáticamente',
    'onboarding.step6.benefit3': 'Nunca más ingresar una transacción manualmente',
    'onboarding.step6.success': '¡Banco conectado exitosamente!',

    // ========================================================================
    // Onboarding Step 7 - Paywall
    // ========================================================================
    'onboarding.step7.title': 'Obtén funciones premium',
    'onboarding.step7.freePlan': 'Plan gratuito',
    'onboarding.step7.price': '$0/año',
    'onboarding.step7.priceSubtext': 'Paga solo si quieres revisión profesional ($49)',
    'onboarding.step7.feature1': 'Declaraciones de impuestos ilimitadas',
    'onboarding.step7.feature2': 'Presenta para ti y tu cónyuge',
    'onboarding.step7.feature3': 'Buscador de deducciones con IA',
    'onboarding.step7.feature4': 'Recordatorios trimestrales de impuestos',
    'onboarding.step7.feature5': 'Soporte en caso de auditoría',
    'onboarding.step7.continueButton': 'Continuar con el plan gratuito',

    // ========================================================================
    // Tab Bar
    // ========================================================================
    'tabs.home': 'Inicio',
    'tabs.insights': 'Análisis',
    'tabs.expenses': 'Gastos',
    'tabs.earnings': 'Ganancias',
    'tabs.fileNow': 'Declarar',
    'tabs.settings': 'Ajustes',

    // ========================================================================
    // Settings Screen
    // ========================================================================
    'settings.title': 'Ajustes',
    'settings.account': 'Cuenta',
    'settings.profile': 'Perfil',
    'settings.manageSubscription': 'Administrar suscripción',
    'settings.upgradeToPro': 'Actualizar a Pro',
    'settings.appearance': 'Apariencia',
    'settings.system': 'Sistema',
    'settings.light': 'Claro',
    'settings.dark': 'Oscuro',
    'settings.preferences': 'Preferencias',
    'settings.hapticFeedback': 'Vibración táctil',
    'settings.tax': 'Impuestos',
    'settings.taxReturns': 'Declaraciones de impuestos',
    'settings.mileageTracking': 'Rastreo de millas',
    'settings.bankConnections': 'Conexiones bancarias',
    'settings.support': 'Soporte',
    'settings.helpSupport': 'Ayuda y soporte',
    'settings.helpMessage': 'Contáctanos en support@gigtax.app para asistencia.',
    'settings.about': 'Acerca de',
    'settings.aboutMessage': 'Versión 1.0.0\nDeclaración de impuestos simplificada para trabajadores independientes.',
    'settings.logOut': 'Cerrar sesión',
    'settings.logOutConfirm': '¿Estás seguro de que quieres cerrar sesión?',
    'settings.cancel': 'Cancelar',
    'settings.language': 'Language / Idioma',
    'settings.languageModalTitle': 'Select Language / Seleccionar idioma',

    // ========================================================================
    // App Entry / Loading
    // ========================================================================
    'app.loading.timeout': 'La carga tardó demasiado. Por favor verifica tu conexión.',
    'app.loading.retry': 'Reintentar',
    'app.error.accountStatus': 'No se pudo verificar el estado de la cuenta. Por favor intenta de nuevo.',

    // ========================================================================
    // Common / Shared
    // ========================================================================
    'common.error': 'Error',
    'common.ok': 'OK',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.done': 'Listo',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.loading': 'Cargando...',
    'common.success': 'Éxito',
  },
};

/**
 * Get a translated string by key for the given language.
 * Falls back to English if the key is not found in the target language.
 * Falls back to the key itself if not found at all.
 */
export function getTranslation(language: Language, key: string): string {
  return translations[language]?.[key] ?? translations.en[key] ?? key;
}

export default translations;
