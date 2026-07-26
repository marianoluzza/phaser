import * as Sentry from '@sentry/browser';

const DEFAULT_SENTRY_DSN =
	'https://fb0e2fe26c346b5dfee2cd1e58784533@o4511753750970368.ingest.us.sentry.io/4511753771220992';

const configuredRelease = import.meta.env.VITE_SENTRY_RELEASE?.trim();
const configuredEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim();

/**
 * Sentry se inicializa antes que Phaser para capturar errores desde el arranque.
 *
 * El DSN identifica al proyecto y es público. Los tokens usados para publicar
 * mapas de código fuente, en cambio, son secretos y nunca deben llegar al cliente.
 */
Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN?.trim() || DEFAULT_SENTRY_DSN,
	environment: configuredEnvironment || import.meta.env.MODE,
	release: configuredRelease || undefined,
	integrations: [
		Sentry.browserTracingIntegration(),
		Sentry.replayIntegration({
			maskAllText: true,
			blockAllMedia: true,
		}),
	],

	// En desarrollo interesa ver todas las trazas; producción conserva una muestra.
	tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
	// El arcade no tiene una API propia a la cual propagar encabezados de trazas.
	tracePropagationTargets: [],

	// Para cuidar la cuota, sólo se conserva la sesión cuando ocurre un error.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1,
});
