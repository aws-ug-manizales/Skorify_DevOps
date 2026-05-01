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
exports.NetworkingModule = void 0;
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
/**
 * Módulo Fundacional de Redes (VPC).
 *
 * Implementa una arquitectura resiliente multi-AZ lista para producción,
 * segmentando el tráfico en tres capas de control perimetral.
 */
class NetworkingModule extends constructs_1.Construct {
    vpc;
    constructor(scope, id, props) {
        super(scope, id);
        this.vpc = new ec2.Vpc(this, 'Vpc', {
            ipAddresses: ec2.IpAddresses.cidr(props.cidr),
            maxAzs: props.maxAzs,
            // Best Practice / Cost Optimization:
            // Reducimos el número de NAT Gateways a 1 para entornos Dev/Staging por ahorro de costos.
            // (AWS cobra 1 NAT Gateway por subred/AZ activo de lo contrario).
            // En Prod, esto se parametriza típicamente para ser igual a 'maxAzs' mediante configuración.
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Public', // Capa Pública: Load Balancers, Bastiones, IGW. Se comunica directo a internet.
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'Private', // Capa de Aplicación: Fargate, ECS, EC2. (Tienen salida a internet por NAT Gtw, PERO NO ingreso directo).
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 24,
                    name: 'Isolated', // Capa de Datos: RDS, ElastiCache, Secrets. Aislada 100% de Internet Security Perimeter.
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });
    }
}
exports.NetworkingModule = NetworkingModule;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2xpYi9tb2R1bGVzL25ldHdvcmtpbmcvbWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5REFBMkM7QUFDM0MsMkNBQXVDO0FBU3ZDOzs7OztHQUtHO0FBQ0gsTUFBYSxnQkFBaUIsU0FBUSxzQkFBUztJQUM3QixHQUFHLENBQVU7SUFFN0IsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDbEMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDN0MsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO1lBRXBCLHFDQUFxQztZQUNyQywwRkFBMEY7WUFDMUYsa0VBQWtFO1lBQ2xFLDZGQUE2RjtZQUM3RixXQUFXLEVBQUUsQ0FBQztZQUVkLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsUUFBUSxFQUFFLGdGQUFnRjtvQkFDaEcsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTTtpQkFDbEM7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFNBQVMsRUFBRSwwR0FBMEc7b0JBQzNILFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtpQkFDL0M7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFVBQVUsRUFBRSx5RkFBeUY7b0JBQzNHLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLGdCQUFnQjtpQkFDNUM7YUFDRjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQW5DRCw0Q0FtQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBOZXR3b3JraW5nTW9kdWxlUHJvcHMge1xuICAvKiogQmxvcXVlIENJRFIgSVB2NCBkZSBsYSBWUEMgY29tcGxldGEgKi9cbiAgcmVhZG9ubHkgY2lkcjogc3RyaW5nO1xuICAvKiogQ2FudGlkYWQgbcOheGltYSBkZSBab25hcyBkZSBEaXNwb25pYmlsaWRhZCAoSEEpICovXG4gIHJlYWRvbmx5IG1heEF6czogbnVtYmVyO1xufVxuXG4vKipcbiAqIE3Ds2R1bG8gRnVuZGFjaW9uYWwgZGUgUmVkZXMgKFZQQykuXG4gKlxuICogSW1wbGVtZW50YSB1bmEgYXJxdWl0ZWN0dXJhIHJlc2lsaWVudGUgbXVsdGktQVogbGlzdGEgcGFyYSBwcm9kdWNjacOzbixcbiAqIHNlZ21lbnRhbmRvIGVsIHRyw6FmaWNvIGVuIHRyZXMgY2FwYXMgZGUgY29udHJvbCBwZXJpbWV0cmFsLlxuICovXG5leHBvcnQgY2xhc3MgTmV0d29ya2luZ01vZHVsZSBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSB2cGM6IGVjMi5WcGM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5ldHdvcmtpbmdNb2R1bGVQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLnZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdWcGMnLCB7XG4gICAgICBpcEFkZHJlc3NlczogZWMyLklwQWRkcmVzc2VzLmNpZHIocHJvcHMuY2lkciksXG4gICAgICBtYXhBenM6IHByb3BzLm1heEF6cyxcblxuICAgICAgLy8gQmVzdCBQcmFjdGljZSAvIENvc3QgT3B0aW1pemF0aW9uOlxuICAgICAgLy8gUmVkdWNpbW9zIGVsIG7Dum1lcm8gZGUgTkFUIEdhdGV3YXlzIGEgMSBwYXJhIGVudG9ybm9zIERldi9TdGFnaW5nIHBvciBhaG9ycm8gZGUgY29zdG9zLlxuICAgICAgLy8gKEFXUyBjb2JyYSAxIE5BVCBHYXRld2F5IHBvciBzdWJyZWQvQVogYWN0aXZvIGRlIGxvIGNvbnRyYXJpbykuXG4gICAgICAvLyBFbiBQcm9kLCBlc3RvIHNlIHBhcmFtZXRyaXphIHTDrXBpY2FtZW50ZSBwYXJhIHNlciBpZ3VhbCBhICdtYXhBenMnIG1lZGlhbnRlIGNvbmZpZ3VyYWNpw7NuLlxuICAgICAgbmF0R2F0ZXdheXM6IDEsXG5cbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiAnUHVibGljJywgLy8gQ2FwYSBQw7pibGljYTogTG9hZCBCYWxhbmNlcnMsIEJhc3Rpb25lcywgSUdXLiBTZSBjb211bmljYSBkaXJlY3RvIGEgaW50ZXJuZXQuXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdQcml2YXRlJywgLy8gQ2FwYSBkZSBBcGxpY2FjacOzbjogRmFyZ2F0ZSwgRUNTLCBFQzIuIChUaWVuZW4gc2FsaWRhIGEgaW50ZXJuZXQgcG9yIE5BVCBHdHcsIFBFUk8gTk8gaW5ncmVzbyBkaXJlY3RvKS5cbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdJc29sYXRlZCcsIC8vIENhcGEgZGUgRGF0b3M6IFJEUywgRWxhc3RpQ2FjaGUsIFNlY3JldHMuIEFpc2xhZGEgMTAwJSBkZSBJbnRlcm5ldCBTZWN1cml0eSBQZXJpbWV0ZXIuXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==