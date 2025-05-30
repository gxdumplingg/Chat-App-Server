const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Chat App API',
            version: '1.0.0',
            description: 'Tài liệu API cho ứng dụng chat',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local server',
            },
        ],
    },
    apis: [
        './routes/*.js',
        './docs/*.swagger.js'
    ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = {
    swaggerUi,
    swaggerSpec,
};
