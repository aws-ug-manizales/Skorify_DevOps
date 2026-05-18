"use strict";
/**
 * Configuración global de la infraestructura de Skorify
 *
 * Sigue el principio "Separation of Concerns". Todos los valores de
 * configuración para cada entorno de AWS viven aquí de forma agnóstica a los módulos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.environments = void 0;
/**
 * Matriz global de entornos. Array que será iterado por el Root de CDK.
 */
exports.environments = [
    {
        name: 'Dev',
        // Si la cuenta y región no se definen, CDK asume "environment-agnostic"
        // lo cual permite desplegar tomando las credenciales locales de la terminal CLI.
        region: 'us-east-1',
        s3: {
            accessLogsBucket: {
                id: 'AccessLogsBucket',
                bucketName: 'skorify-access-logs-dev',
                expirationDays: 180,
                abortIncompleteMultipartUploadAfterDays: 7,
            },
            buckets: [
                {
                    id: 'AssetsBucket',
                    bucketName: 'skorify-assets-dev',
                    removalPolicy: 'DESTROY',
                    autoDeleteObjects: true,
                    eventBridgeEnabled: true,
                    encryption: {
                        type: 'CUSTOMER_MANAGED',
                        kmsAlias: 'alias/skorify/dev/assets',
                    },
                    logging: {
                        prefix: 'assets/',
                    },
                    lifecycleRules: [
                        {
                            id: 'AbortIncompleteMultipartUploads',
                            abortIncompleteMultipartUploadAfterDays: 7,
                        },
                        {
                            id: 'TransitionOldObjects',
                            transitions: [
                                {
                                    storageClass: 'INTELLIGENT_TIERING',
                                    transitionAfterDays: 30,
                                },
                            ],
                            noncurrentVersionExpirationDays: 90,
                        },
                    ],
                },
            ],
        },
    },
    // {
    //   name: 'Prod',
    //   account: '123456789012', // En prod SIEMPRE forzamos la cuenta para protección "anti-accidentes".
    //   region: 'us-east-1',
    //   s3: { ... }
    // }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2NvbmZpZy9lbnZpcm9ubWVudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7QUF1R0g7O0dBRUc7QUFDVSxRQUFBLFlBQVksR0FBd0I7SUFDL0M7UUFDRSxJQUFJLEVBQUUsS0FBSztRQUNYLHdFQUF3RTtRQUN4RSxpRkFBaUY7UUFDakYsTUFBTSxFQUFFLFdBQVc7UUFFbkIsRUFBRSxFQUFFO1lBQ0YsZ0JBQWdCLEVBQUU7Z0JBQ2hCLEVBQUUsRUFBRSxrQkFBa0I7Z0JBQ3RCLFVBQVUsRUFBRSx5QkFBeUI7Z0JBQ3JDLGNBQWMsRUFBRSxHQUFHO2dCQUNuQix1Q0FBdUMsRUFBRSxDQUFDO2FBQzNDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQO29CQUNFLEVBQUUsRUFBRSxjQUFjO29CQUNsQixVQUFVLEVBQUUsb0JBQW9CO29CQUNoQyxhQUFhLEVBQUUsU0FBUztvQkFDeEIsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsa0JBQWtCLEVBQUUsSUFBSTtvQkFDeEIsVUFBVSxFQUFFO3dCQUNWLElBQUksRUFBRSxrQkFBa0I7d0JBQ3hCLFFBQVEsRUFBRSwwQkFBMEI7cUJBQ3JDO29CQUNELE9BQU8sRUFBRTt3QkFDUCxNQUFNLEVBQUUsU0FBUztxQkFDbEI7b0JBQ0QsY0FBYyxFQUFFO3dCQUNkOzRCQUNFLEVBQUUsRUFBRSxpQ0FBaUM7NEJBQ3JDLHVDQUF1QyxFQUFFLENBQUM7eUJBQzNDO3dCQUNEOzRCQUNFLEVBQUUsRUFBRSxzQkFBc0I7NEJBQzFCLFdBQVcsRUFBRTtnQ0FDWDtvQ0FDRSxZQUFZLEVBQUUscUJBQXFCO29DQUNuQyxtQkFBbUIsRUFBRSxFQUFFO2lDQUN4Qjs2QkFDRjs0QkFDRCwrQkFBK0IsRUFBRSxFQUFFO3lCQUNwQztxQkFDRjtpQkFDRjthQUNGO1NBQ0Y7S0FDRjtJQUNELElBQUk7SUFDSixrQkFBa0I7SUFDbEIsc0dBQXNHO0lBQ3RHLHlCQUF5QjtJQUV6QixnQkFBZ0I7SUFDaEIsSUFBSTtDQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbmZpZ3VyYWNpw7NuIGdsb2JhbCBkZSBsYSBpbmZyYWVzdHJ1Y3R1cmEgZGUgU2tvcmlmeVxuICpcbiAqIFNpZ3VlIGVsIHByaW5jaXBpbyBcIlNlcGFyYXRpb24gb2YgQ29uY2VybnNcIi4gVG9kb3MgbG9zIHZhbG9yZXMgZGVcbiAqIGNvbmZpZ3VyYWNpw7NuIHBhcmEgY2FkYSBlbnRvcm5vIGRlIEFXUyB2aXZlbiBhcXXDrSBkZSBmb3JtYSBhZ27Ds3N0aWNhIGEgbG9zIG3Ds2R1bG9zLlxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgUzNDb25maWcge1xuICAvKiogQnVja2V0IGRlZGljYWRvIHBhcmEgYWNjZXNzIGxvZ3MgZGVsIGdydXBvIGRlIGJ1Y2tldHMgZ2VzdGlvbmFkb3MgcG9yIGVzdGEgaW52b2NhY2nDs24uICovXG4gIHJlYWRvbmx5IGFjY2Vzc0xvZ3NCdWNrZXQ/OiBTM0FjY2Vzc0xvZ3NCdWNrZXRDb25maWc7XG4gIC8qKiBCdWNrZXRzIGEgY3JlYXIgcGFyYSBlbCBlbnRvcm5vLiBQZXJtaXRlIGNvbXBvbmVyIGFsbWFjZW5hbWllbnRvIHBvciBsb3RlcyBkZXNkZSBjb25maWd1cmFjacOzbi4gKi9cbiAgcmVhZG9ubHkgYnVja2V0czogcmVhZG9ubHkgUzNCdWNrZXRDb25maWdbXTtcbn1cblxuZXhwb3J0IHR5cGUgUzNCdWNrZXRFbmNyeXB0aW9uVHlwZSA9ICdTM19NQU5BR0VEJyB8ICdLTVNfTUFOQUdFRCcgfCAnQ1VTVE9NRVJfTUFOQUdFRCc7XG5leHBvcnQgdHlwZSBTM1JlbW92YWxQb2xpY3lOYW1lID0gJ0RFU1RST1knIHwgJ1JFVEFJTic7XG5leHBvcnQgdHlwZSBTM1N0b3JhZ2VDbGFzc05hbWUgPVxuICB8ICdJTlRFTExJR0VOVF9USUVSSU5HJ1xuICB8ICdTVEFOREFSRF9JQSdcbiAgfCAnT05FX1pPTkVfSUEnXG4gIHwgJ0dMQUNJRVJfSVInXG4gIHwgJ0dMQUNJRVInXG4gIHwgJ0RFRVBfQVJDSElWRSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUzNBY2Nlc3NMb2dzQnVja2V0Q29uZmlnIHtcbiAgLyoqIElkZW50aWZpY2Fkb3IgbMOzZ2ljbyBkZWwgYnVja2V0IGRlIGxvZ3MuICovXG4gIHJlYWRvbmx5IGlkOiBzdHJpbmc7XG4gIC8qKiBOb21icmUgZsOtc2ljbyBvcGNpb25hbCBkZWwgYnVja2V0IGRlIGxvZ3MuICovXG4gIHJlYWRvbmx5IGJ1Y2tldE5hbWU/OiBzdHJpbmc7XG4gIC8qKiBEw61hcyB0cmFzIGxvcyBjdWFsZXMgZXhwaXJhbiBsb3MgbG9ncy4gKi9cbiAgcmVhZG9ubHkgZXhwaXJhdGlvbkRheXM/OiBudW1iZXI7XG4gIC8qKiBEw61hcyBwYXJhIGFib3J0YXIgdXBsb2FkcyBtdWx0aXBhcnQgaW5jb21wbGV0b3MuICovXG4gIHJlYWRvbmx5IGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyRGF5cz86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTM0J1Y2tldENvbmZpZyB7XG4gIC8qKiBJZGVudGlmaWNhZG9yIGzDs2dpY28gZGVsIGJ1Y2tldCBkZW50cm8gZGVsIG3Ds2R1bG8uIERlYmUgc2VyIMO6bmljbyBwb3IgaW52b2NhY2nDs24uICovXG4gIHJlYWRvbmx5IGlkOiBzdHJpbmc7XG4gIC8qKiBOb21icmUgZsOtc2ljbyBvcGNpb25hbCBkZWwgYnVja2V0LiDDmnNhbG8gc29sbyBzaSB1bmEgaW50ZWdyYWNpw7NuIGxvIGV4aWdlLiAqL1xuICByZWFkb25seSBidWNrZXROYW1lPzogc3RyaW5nO1xuICAvKiogUG9sw610aWNhIGRlIGNpZnJhZG8gZGVsIGJ1Y2tldC4gKi9cbiAgcmVhZG9ubHkgZW5jcnlwdGlvbj86IFMzQnVja2V0RW5jcnlwdGlvbkNvbmZpZztcbiAgLyoqIFBvbMOtdGljYSBkZSByZXRlbmNpw7NuIGRlbCByZWN1cnNvLiAqL1xuICByZWFkb25seSByZW1vdmFsUG9saWN5PzogUzNSZW1vdmFsUG9saWN5TmFtZTtcbiAgLyoqIFBlcm1pdGUgYm9ycmFyIG9iamV0b3MgYXV0b23DoXRpY2FtZW50ZSBjdWFuZG8gZWwgYnVja2V0IHNlIGRlc3RydXllLiAqL1xuICByZWFkb25seSBhdXRvRGVsZXRlT2JqZWN0cz86IGJvb2xlYW47XG4gIC8qKiBIYWJpbGl0YSB2ZXJzaW9uYWRvIGRlbCBidWNrZXQuICovXG4gIHJlYWRvbmx5IHZlcnNpb25lZD86IGJvb2xlYW47XG4gIC8qKiBQdWJsaWNhIGV2ZW50b3MgZGVsIGJ1Y2tldCBlbiBFdmVudEJyaWRnZS4gKi9cbiAgcmVhZG9ubHkgZXZlbnRCcmlkZ2VFbmFibGVkPzogYm9vbGVhbjtcbiAgLyoqIEFjdGl2YSBzZXJ2ZXIgYWNjZXNzIGxvZ2dpbmcgcGFyYSBlc3RlIGJ1Y2tldC4gKi9cbiAgcmVhZG9ubHkgbG9nZ2luZz86IFMzQnVja2V0TG9nZ2luZ0NvbmZpZztcbiAgLyoqIFJlZ2xhcyBkZSBsaWZlY3ljbGUgcGFyYSBkYXRvcyB5IHZlcnNpb25lcy4gKi9cbiAgcmVhZG9ubHkgbGlmZWN5Y2xlUnVsZXM/OiByZWFkb25seSBTM0xpZmVjeWNsZVJ1bGVDb25maWdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTM0J1Y2tldEVuY3J5cHRpb25Db25maWcge1xuICAvKiogVGlwbyBkZSBjaWZyYWRvIGVuIHJlcG9zby4gKi9cbiAgcmVhZG9ubHkgdHlwZTogUzNCdWNrZXRFbmNyeXB0aW9uVHlwZTtcbiAgLyoqIEFsaWFzIEtNUyBzb2xvIGN1YW5kbyBzZSB1c2EgQ1VTVE9NRVJfTUFOQUdFRC4gKi9cbiAgcmVhZG9ubHkga21zQWxpYXM/OiBzdHJpbmc7XG4gIC8qKiBSb3RhY2nDs24gZGUgbGEgbGxhdmUgS01TIGFkbWluaXN0cmFkYSBwb3IgZWwgY2xpZW50ZS4gKi9cbiAgcmVhZG9ubHkgZW5hYmxlS2V5Um90YXRpb24/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFMzQnVja2V0TG9nZ2luZ0NvbmZpZyB7XG4gIC8qKiBQZXJtaXRlIGRlc2FjdGl2YXIgbG9nZ2luZyBwb3IgYnVja2V0OyBwb3IgZGVmZWN0byBlc3TDoSBhY3Rpdm8uICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ/OiBib29sZWFuO1xuICAvKiogUHJlZmlqbyB1c2FkbyBkZW50cm8gZGVsIGJ1Y2tldCBkZSBsb2dzLiAqL1xuICByZWFkb25seSBwcmVmaXg/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUzNUcmFuc2l0aW9uQ29uZmlnIHtcbiAgLyoqIFN0b3JhZ2UgY2xhc3MgZGUgZGVzdGluby4gKi9cbiAgcmVhZG9ubHkgc3RvcmFnZUNsYXNzOiBTM1N0b3JhZ2VDbGFzc05hbWU7XG4gIC8qKiBEw61hcyBhbnRlcyBkZSBtb3ZlciBsYSBkYXRhLiAqL1xuICByZWFkb25seSB0cmFuc2l0aW9uQWZ0ZXJEYXlzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUzNMaWZlY3ljbGVSdWxlQ29uZmlnIHtcbiAgLyoqIElkZW50aWZpY2Fkb3IgZGUgbGEgcmVnbGEuICovXG4gIHJlYWRvbmx5IGlkPzogc3RyaW5nO1xuICAvKiogUHJlZmlqbyBvcGNpb25hbCBwYXJhIGZpbHRyYXIgb2JqZXRvcy4gKi9cbiAgcmVhZG9ubHkgcHJlZml4Pzogc3RyaW5nO1xuICAvKiogSGFiaWxpdGEgbyBkZXNoYWJpbGl0YSBsYSByZWdsYS4gKi9cbiAgcmVhZG9ubHkgZW5hYmxlZD86IGJvb2xlYW47XG4gIC8qKiBEw61hcyBwYXJhIGV4cGlyYXIgdmVyc2lvbmVzIGFjdHVhbGVzLiAqL1xuICByZWFkb25seSBleHBpcmF0aW9uRGF5cz86IG51bWJlcjtcbiAgLyoqIETDrWFzIHBhcmEgZXhwaXJhciB2ZXJzaW9uZXMgbm8gYWN0dWFsZXMuICovXG4gIHJlYWRvbmx5IG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbkRheXM/OiBudW1iZXI7XG4gIC8qKiBEw61hcyBwYXJhIGFib3J0YXIgdXBsb2FkcyBtdWx0aXBhcnQgaW5jb21wbGV0b3MuICovXG4gIHJlYWRvbmx5IGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyRGF5cz86IG51bWJlcjtcbiAgLyoqIFRyYW5zaWNpb25lcyBkZSBzdG9yYWdlIGNsYXNzLiAqL1xuICByZWFkb25seSB0cmFuc2l0aW9ucz86IHJlYWRvbmx5IFMzVHJhbnNpdGlvbkNvbmZpZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVudmlyb25tZW50Q29uZmlnIHtcbiAgLyoqIE5vbWJyZSBzZW3DoW50aWNvIGRlbCBlbnRvcm5vIChlai4gRGV2LCBTdGFnaW5nLCBQcm9kKSAqL1xuICByZWFkb25seSBuYW1lOiBzdHJpbmc7XG4gIC8qKiBDdWVudGEgZGUgQVdTIGRlc3Rpbm8gKElEIGRlIDEyIGTDrWdpdG9zKSAqL1xuICByZWFkb25seSBhY2NvdW50Pzogc3RyaW5nO1xuICAvKiogUmVnacOzbiBkZSBBV1MgZGVzdGlubyAoZWouIHVzLWVhc3QtMSkgKi9cbiAgcmVhZG9ubHkgcmVnaW9uPzogc3RyaW5nO1xuXG4gIC8qKiBDb25maWd1cmFjacOzbiBpbnllY3RhZGEgYWwgbcOzZHVsbyBkZSBBbG1hY2VuYW1pZW50byBTMyAqL1xuICByZWFkb25seSBzMzogUzNDb25maWc7XG59XG5cbi8qKlxuICogTWF0cml6IGdsb2JhbCBkZSBlbnRvcm5vcy4gQXJyYXkgcXVlIHNlcsOhIGl0ZXJhZG8gcG9yIGVsIFJvb3QgZGUgQ0RLLlxuICovXG5leHBvcnQgY29uc3QgZW52aXJvbm1lbnRzOiBFbnZpcm9ubWVudENvbmZpZ1tdID0gW1xuICB7XG4gICAgbmFtZTogJ0RldicsXG4gICAgLy8gU2kgbGEgY3VlbnRhIHkgcmVnacOzbiBubyBzZSBkZWZpbmVuLCBDREsgYXN1bWUgXCJlbnZpcm9ubWVudC1hZ25vc3RpY1wiXG4gICAgLy8gbG8gY3VhbCBwZXJtaXRlIGRlc3BsZWdhciB0b21hbmRvIGxhcyBjcmVkZW5jaWFsZXMgbG9jYWxlcyBkZSBsYSB0ZXJtaW5hbCBDTEkuXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcblxuICAgIHMzOiB7XG4gICAgICBhY2Nlc3NMb2dzQnVja2V0OiB7XG4gICAgICAgIGlkOiAnQWNjZXNzTG9nc0J1Y2tldCcsXG4gICAgICAgIGJ1Y2tldE5hbWU6ICdza29yaWZ5LWFjY2Vzcy1sb2dzLWRldicsXG4gICAgICAgIGV4cGlyYXRpb25EYXlzOiAxODAsXG4gICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyRGF5czogNyxcbiAgICAgIH0sXG4gICAgICBidWNrZXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0Fzc2V0c0J1Y2tldCcsXG4gICAgICAgICAgYnVja2V0TmFtZTogJ3Nrb3JpZnktYXNzZXRzLWRldicsXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogJ0RFU1RST1knLFxuICAgICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgICAgIGV2ZW50QnJpZGdlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgICAgICB0eXBlOiAnQ1VTVE9NRVJfTUFOQUdFRCcsXG4gICAgICAgICAgICBrbXNBbGlhczogJ2FsaWFzL3Nrb3JpZnkvZGV2L2Fzc2V0cycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBsb2dnaW5nOiB7XG4gICAgICAgICAgICBwcmVmaXg6ICdhc3NldHMvJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGlkOiAnQWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyRGF5czogNyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGlkOiAnVHJhbnNpdGlvbk9sZE9iamVjdHMnLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogJ0lOVEVMTElHRU5UX1RJRVJJTkcnLFxuICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyRGF5czogMzAsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uRGF5czogOTAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIH0sXG4gIC8vIHtcbiAgLy8gICBuYW1lOiAnUHJvZCcsXG4gIC8vICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsIC8vIEVuIHByb2QgU0lFTVBSRSBmb3J6YW1vcyBsYSBjdWVudGEgcGFyYSBwcm90ZWNjacOzbiBcImFudGktYWNjaWRlbnRlc1wiLlxuICAvLyAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG5cbiAgLy8gICBzMzogeyAuLi4gfVxuICAvLyB9XG5dO1xuIl19