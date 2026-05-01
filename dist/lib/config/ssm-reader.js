"use strict";
/**
 * Servicio de configuración basado en AWS Parameter Store
 *
 * Lee la configuración del ambiente desde Parameter Store de la cuenta
 * donde se ejecuta el CDK. Cada cuenta (dev, staging, prod) tiene sus
 * propios valores bajo el prefijo /skorify/.
 *
 * Beneficios:
 * - Un solo código para todos los ambientes
 * - Configuración segura fuera del repositorio
 * - Cada pipeline despliega solo a su cuenta
 *
 * Parámetros requeridos:
 * - /skorify/s3/buckets         → JSON string (S3BucketDefinition[])
 */
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
exports.loadConfigFromSSM = loadConfigFromSSM;
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
// ============================================================
// Helpers internos
// ============================================================
/**
 * Lee un parámetro String desde Parameter Store y lo parsea como JSON.
 *
 * Durante el primer `cdk synth`, CDK aún no tiene el valor en cdk.context.json
 * y retorna un placeholder como "dummy-value-for-/skorify/s3/buckets".
 * JSON.parse fallará en ese caso — se retorna `fallback` silenciosamente.
 * CDK hará un segundo synth con el valor real cacheado en cdk.context.json.
 */
function getJsonParameter(scope, name, fallback) {
    const raw = ssm.StringParameter.valueFromLookup(scope, `/skorify/${name}`);
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
// ============================================================
// Función principal de carga
// ============================================================
/**
 * Lee la configuración completa del ambiente desde Parameter Store.
 *
 * Parámetros esperados en la cuenta:
 *   /skorify/s3/buckets        → JSON array de S3BucketDefinition[]
 */
function loadConfigFromSSM(scope) {
    return {
        s3Buckets: getJsonParameter(scope, 's3/buckets', []),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtLXJlYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi9jb25maWcvc3NtLXJlYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7O0dBY0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK0NILDhDQUlDO0FBakRELHlEQUEyQztBQWMzQywrREFBK0Q7QUFDL0QsbUJBQW1CO0FBQ25CLCtEQUErRDtBQUUvRDs7Ozs7OztHQU9HO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBSSxLQUFnQixFQUFFLElBQVksRUFBRSxRQUFXO0lBQ3RFLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxZQUFZLElBQUksRUFBRSxDQUFDLENBQUM7SUFDM0UsSUFBSSxDQUFDO1FBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBTSxDQUFDO0lBQzlCLENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0FBQ0gsQ0FBQztBQUVELCtEQUErRDtBQUMvRCw2QkFBNkI7QUFDN0IsK0RBQStEO0FBRS9EOzs7OztHQUtHO0FBQ0gsU0FBZ0IsaUJBQWlCLENBQUMsS0FBZ0I7SUFDaEQsT0FBTztRQUNMLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBdUIsS0FBSyxFQUFFLFlBQVksRUFBRSxFQUFFLENBQUM7S0FDM0UsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNlcnZpY2lvIGRlIGNvbmZpZ3VyYWNpw7NuIGJhc2FkbyBlbiBBV1MgUGFyYW1ldGVyIFN0b3JlXG4gKlxuICogTGVlIGxhIGNvbmZpZ3VyYWNpw7NuIGRlbCBhbWJpZW50ZSBkZXNkZSBQYXJhbWV0ZXIgU3RvcmUgZGUgbGEgY3VlbnRhXG4gKiBkb25kZSBzZSBlamVjdXRhIGVsIENESy4gQ2FkYSBjdWVudGEgKGRldiwgc3RhZ2luZywgcHJvZCkgdGllbmUgc3VzXG4gKiBwcm9waW9zIHZhbG9yZXMgYmFqbyBlbCBwcmVmaWpvIC9za29yaWZ5Ly5cbiAqXG4gKiBCZW5lZmljaW9zOlxuICogLSBVbiBzb2xvIGPDs2RpZ28gcGFyYSB0b2RvcyBsb3MgYW1iaWVudGVzXG4gKiAtIENvbmZpZ3VyYWNpw7NuIHNlZ3VyYSBmdWVyYSBkZWwgcmVwb3NpdG9yaW9cbiAqIC0gQ2FkYSBwaXBlbGluZSBkZXNwbGllZ2Egc29sbyBhIHN1IGN1ZW50YVxuICpcbiAqIFBhcsOhbWV0cm9zIHJlcXVlcmlkb3M6XG4gKiAtIC9za29yaWZ5L3MzL2J1Y2tldHMgICAgICAgICDihpIgSlNPTiBzdHJpbmcgKFMzQnVja2V0RGVmaW5pdGlvbltdKVxuICovXG5cbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgUzNCdWNrZXREZWZpbml0aW9uIH0gZnJvbSAnLi4vbW9kdWxlcy9zMy9tYWluJztcblxuLyoqIENvbmZpZ3VyYWNpw7NuIGxlw61kYSBkZXNkZSBQYXJhbWV0ZXIgU3RvcmUuICovXG5leHBvcnQgaW50ZXJmYWNlIFMzQ29uZmlnRnJvbVNTTSB7XG4gIC8qKlxuICAgKiBMaXN0YSBkZSBidWNrZXRzIFMzIGEgY3JlYXIuXG4gICAqIFBhcnNlYWRhIGRlc2RlIGVsIHBhcsOhbWV0cm8gL3Nrb3JpZnkvczMvYnVja2V0cyAoSlNPTiBzdHJpbmcpLlxuICAgKiBWYWPDrWEgZHVyYW50ZSBlbCBwcmltZXIgY2RrIHN5bnRoIOKAlCBDREsgcmVzdWVsdmUgZW4gZWwgc2VndW5kbyBwYXNlLlxuICAgKi9cbiAgcmVhZG9ubHkgczNCdWNrZXRzOiBTM0J1Y2tldERlZmluaXRpb25bXTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBIZWxwZXJzIGludGVybm9zXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBMZWUgdW4gcGFyw6FtZXRybyBTdHJpbmcgZGVzZGUgUGFyYW1ldGVyIFN0b3JlIHkgbG8gcGFyc2VhIGNvbW8gSlNPTi5cbiAqXG4gKiBEdXJhbnRlIGVsIHByaW1lciBgY2RrIHN5bnRoYCwgQ0RLIGHDum4gbm8gdGllbmUgZWwgdmFsb3IgZW4gY2RrLmNvbnRleHQuanNvblxuICogeSByZXRvcm5hIHVuIHBsYWNlaG9sZGVyIGNvbW8gXCJkdW1teS12YWx1ZS1mb3ItL3Nrb3JpZnkvczMvYnVja2V0c1wiLlxuICogSlNPTi5wYXJzZSBmYWxsYXLDoSBlbiBlc2UgY2FzbyDigJQgc2UgcmV0b3JuYSBgZmFsbGJhY2tgIHNpbGVuY2lvc2FtZW50ZS5cbiAqIENESyBoYXLDoSB1biBzZWd1bmRvIHN5bnRoIGNvbiBlbCB2YWxvciByZWFsIGNhY2hlYWRvIGVuIGNkay5jb250ZXh0Lmpzb24uXG4gKi9cbmZ1bmN0aW9uIGdldEpzb25QYXJhbWV0ZXI8VD4oc2NvcGU6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBmYWxsYmFjazogVCk6IFQge1xuICBjb25zdCByYXcgPSBzc20uU3RyaW5nUGFyYW1ldGVyLnZhbHVlRnJvbUxvb2t1cChzY29wZSwgYC9za29yaWZ5LyR7bmFtZX1gKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShyYXcpIGFzIFQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxsYmFjaztcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEZ1bmNpw7NuIHByaW5jaXBhbCBkZSBjYXJnYVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICogTGVlIGxhIGNvbmZpZ3VyYWNpw7NuIGNvbXBsZXRhIGRlbCBhbWJpZW50ZSBkZXNkZSBQYXJhbWV0ZXIgU3RvcmUuXG4gKlxuICogUGFyw6FtZXRyb3MgZXNwZXJhZG9zIGVuIGxhIGN1ZW50YTpcbiAqICAgL3Nrb3JpZnkvczMvYnVja2V0cyAgICAgICAg4oaSIEpTT04gYXJyYXkgZGUgUzNCdWNrZXREZWZpbml0aW9uW11cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvYWRDb25maWdGcm9tU1NNKHNjb3BlOiBDb25zdHJ1Y3QpOiBTM0NvbmZpZ0Zyb21TU00ge1xuICByZXR1cm4ge1xuICAgIHMzQnVja2V0czogZ2V0SnNvblBhcmFtZXRlcjxTM0J1Y2tldERlZmluaXRpb25bXT4oc2NvcGUsICdzMy9idWNrZXRzJywgW10pLFxuICB9O1xufVxuIl19