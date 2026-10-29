import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		watch: {
			// Fuentes y salidas que no forman parte de la aplicación: vigilarlas sólo
			// hace más lenta la primera carga. Las hojas de arte llegan como PNG y
			// JSON en public/, que sí se vigila.
			ignored: ['**/art/**', '**/screenshots/**', '**/local-assets/**', '**/dist/**', '**/tools/**'],
		},
	},
});
