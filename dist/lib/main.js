#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const ssm_reader_1 = require("./config/ssm-reader");
const main_1 = require("./modules/s3/main");
const app = new cdk.App();
const environmentName = process.env.SKORIFY_ENVIRONMENT ?? 'dev';
// ==========================================
// Skorify CDK App — Configuración desde Parameter Store
// ==========================================
// Este código lee la configuración desde Parameter Store de la cuenta
// donde se ejecuta. Cada cuenta (dev, staging, prod) tiene sus propios
// valores bajo el prefijo /skorify/.
//
// Parámetros requeridos en Parameter Store:
//   /skorify/s3/buckets        → JSON array de S3BucketDefinition[]
// ==========================================
const lookupStack = new cdk.Stack(app, 'SkorifyConfigLookup', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});
const config = (0, ssm_reader_1.loadConfigFromSSM)(lookupStack);
// ==========================================
// Stack principal
// ==========================================
const envStack = new cdk.Stack(app, 'SkorifyInfra', {
    stackName: 'skorify-infra',
    // El entorno (account/region) se toma del CLI/rol activo.
    // No se hardcodean cuentas aquí.
    description: `Infraestructura base para el ambiente: ${environmentName}`,
    tags: {
        Environment: environmentName,
        Project: 'Skorify_Infraestructura',
        ManagedBy: 'AWS CDK',
    },
});
// ==========================================
// Módulo de Almacenamiento (S3)
//
// Guard: durante el primer cdk synth, SSM retorna un placeholder y
// s3Buckets estará vacío. El módulo lo maneja internamente con un
// early return. CDK resolverá los valores reales en el segundo synth.
// ==========================================
if (config.s3Buckets.length > 0) {
    new main_1.S3Module(envStack, 'S3Storage', {
        buckets: config.s3Buckets,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsb0RBQXdEO0FBQ3hELDRDQUE2QztBQUU3QyxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUMxQixNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixJQUFJLEtBQUssQ0FBQztBQUVqRSw2Q0FBNkM7QUFDN0Msd0RBQXdEO0FBQ3hELDZDQUE2QztBQUM3QyxzRUFBc0U7QUFDdEUsdUVBQXVFO0FBQ3ZFLHFDQUFxQztBQUNyQyxFQUFFO0FBQ0YsNENBQTRDO0FBQzVDLG9FQUFvRTtBQUNwRSw2Q0FBNkM7QUFFN0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxxQkFBcUIsRUFBRTtJQUM1RCxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCO0tBQ3ZDO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsTUFBTSxNQUFNLEdBQUcsSUFBQSw4QkFBaUIsRUFBQyxXQUFXLENBQUMsQ0FBQztBQUU5Qyw2Q0FBNkM7QUFDN0Msa0JBQWtCO0FBQ2xCLDZDQUE2QztBQUM3QyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLGNBQWMsRUFBRTtJQUNsRCxTQUFTLEVBQUUsZUFBZTtJQUUxQiwwREFBMEQ7SUFDMUQsaUNBQWlDO0lBRWpDLFdBQVcsRUFBRSwwQ0FBMEMsZUFBZSxFQUFFO0lBRXhFLElBQUksRUFBRTtRQUNKLFdBQVcsRUFBRSxlQUFlO1FBQzVCLE9BQU8sRUFBRSx5QkFBeUI7UUFDbEMsU0FBUyxFQUFFLFNBQVM7S0FDckI7Q0FDRixDQUFDLENBQUM7QUFFSCw2Q0FBNkM7QUFDN0MsZ0NBQWdDO0FBQ2hDLEVBQUU7QUFDRixtRUFBbUU7QUFDbkUsa0VBQWtFO0FBQ2xFLHNFQUFzRTtBQUN0RSw2Q0FBNkM7QUFDN0MsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUNoQyxJQUFJLGVBQVEsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFO1FBQ2xDLE9BQU8sRUFBRSxNQUFNLENBQUMsU0FBUztLQUMxQixDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IGxvYWRDb25maWdGcm9tU1NNIH0gZnJvbSAnLi9jb25maWcvc3NtLXJlYWRlcic7XG5pbXBvcnQgeyBTM01vZHVsZSB9IGZyb20gJy4vbW9kdWxlcy9zMy9tYWluJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbmNvbnN0IGVudmlyb25tZW50TmFtZSA9IHByb2Nlc3MuZW52LlNLT1JJRllfRU5WSVJPTk1FTlQgPz8gJ2Rldic7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2tvcmlmeSBDREsgQXBwIOKAlCBDb25maWd1cmFjacOzbiBkZXNkZSBQYXJhbWV0ZXIgU3RvcmVcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXN0ZSBjw7NkaWdvIGxlZSBsYSBjb25maWd1cmFjacOzbiBkZXNkZSBQYXJhbWV0ZXIgU3RvcmUgZGUgbGEgY3VlbnRhXG4vLyBkb25kZSBzZSBlamVjdXRhLiBDYWRhIGN1ZW50YSAoZGV2LCBzdGFnaW5nLCBwcm9kKSB0aWVuZSBzdXMgcHJvcGlvc1xuLy8gdmFsb3JlcyBiYWpvIGVsIHByZWZpam8gL3Nrb3JpZnkvLlxuLy9cbi8vIFBhcsOhbWV0cm9zIHJlcXVlcmlkb3MgZW4gUGFyYW1ldGVyIFN0b3JlOlxuLy8gICAvc2tvcmlmeS9zMy9idWNrZXRzICAgICAgICDihpIgSlNPTiBhcnJheSBkZSBTM0J1Y2tldERlZmluaXRpb25bXVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IGxvb2t1cFN0YWNrID0gbmV3IGNkay5TdGFjayhhcHAsICdTa29yaWZ5Q29uZmlnTG9va3VwJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OLFxuICB9LFxufSk7XG5cbmNvbnN0IGNvbmZpZyA9IGxvYWRDb25maWdGcm9tU1NNKGxvb2t1cFN0YWNrKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayBwcmluY2lwYWxcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc3QgZW52U3RhY2sgPSBuZXcgY2RrLlN0YWNrKGFwcCwgJ1Nrb3JpZnlJbmZyYScsIHtcbiAgc3RhY2tOYW1lOiAnc2tvcmlmeS1pbmZyYScsXG5cbiAgLy8gRWwgZW50b3JubyAoYWNjb3VudC9yZWdpb24pIHNlIHRvbWEgZGVsIENMSS9yb2wgYWN0aXZvLlxuICAvLyBObyBzZSBoYXJkY29kZWFuIGN1ZW50YXMgYXF1w60uXG5cbiAgZGVzY3JpcHRpb246IGBJbmZyYWVzdHJ1Y3R1cmEgYmFzZSBwYXJhIGVsIGFtYmllbnRlOiAke2Vudmlyb25tZW50TmFtZX1gLFxuXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnROYW1lLFxuICAgIFByb2plY3Q6ICdTa29yaWZ5X0luZnJhZXN0cnVjdHVyYScsXG4gICAgTWFuYWdlZEJ5OiAnQVdTIENESycsXG4gIH0sXG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBNw7NkdWxvIGRlIEFsbWFjZW5hbWllbnRvIChTMylcbi8vXG4vLyBHdWFyZDogZHVyYW50ZSBlbCBwcmltZXIgY2RrIHN5bnRoLCBTU00gcmV0b3JuYSB1biBwbGFjZWhvbGRlciB5XG4vLyBzM0J1Y2tldHMgZXN0YXLDoSB2YWPDrW8uIEVsIG3Ds2R1bG8gbG8gbWFuZWphIGludGVybmFtZW50ZSBjb24gdW5cbi8vIGVhcmx5IHJldHVybi4gQ0RLIHJlc29sdmVyw6EgbG9zIHZhbG9yZXMgcmVhbGVzIGVuIGVsIHNlZ3VuZG8gc3ludGguXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmlmIChjb25maWcuczNCdWNrZXRzLmxlbmd0aCA+IDApIHtcbiAgbmV3IFMzTW9kdWxlKGVudlN0YWNrLCAnUzNTdG9yYWdlJywge1xuICAgIGJ1Y2tldHM6IGNvbmZpZy5zM0J1Y2tldHMsXG4gIH0pO1xufVxuIl19