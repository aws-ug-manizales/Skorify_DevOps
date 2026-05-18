import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface NetworkingModuleProps {
    /** Bloque CIDR IPv4 de la VPC completa */
    readonly cidr: string;
    /** Cantidad máxima de Zonas de Disponibilidad (HA) */
    readonly maxAzs: number;
}
/**
 * Módulo Fundacional de Redes (VPC).
 *
 * Implementa una arquitectura resiliente multi-AZ lista para producción,
 * segmentando el tráfico en tres capas de control perimetral.
 */
export declare class NetworkingModule extends Construct {
    readonly vpc: ec2.Vpc;
    constructor(scope: Construct, id: string, props: NetworkingModuleProps);
}
