import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface VpcModuleProps {
  /** Nombre de la VPC en AWS (tag Name). */
  readonly vpcName: string;

  /** CIDR principal de la VPC. */
  readonly cidr: string;

  /** CIDRs de las 3 subnets privadas. */
  readonly privateSubnetCidrs?: string[];
}

/**
 * Modulo de networking privado.
 *
 * Crea una VPC sin NAT ni Internet Gateway, con 3 subnets privadas,
 * 3 route tables privadas y asociaciones entre subnets y rutas.
 */
export class VpcModule extends Construct {
  /** Referencia reutilizable de la VPC para otros módulos/stacks. */
  public readonly vpc: ec2.IVpc;

  /** Lista de subnets privadas creadas por el módulo. */
  public readonly privateSubnets: ec2.ISubnet[];

  /**
   * Construye el networking base del entorno.
   *
   * Flujo general:
   * 1. Valida que existan exactamente 3 CIDRs de subnets privadas.
   * 2. Resuelve dinámicamente 3 Availability Zones.
   * 3. Crea una VPC sin recursos públicos (sin NAT/IGW).
   * 4. Crea una subnet privada por AZ.
   * 5. Crea una route table privada por subnet.
   * 6. Asocia cada subnet a su route table correspondiente.
   * 7. Expone referencias tipadas (IVpc/ISubnet[]) para reutilización.
   *
   * @param scope Construct padre donde vive el módulo.
   * @param id Identificador lógico del módulo dentro del scope.
   * @param props Parámetros de red (nombre de VPC, CIDR y subnets privadas).
   */
  constructor(scope: Construct, id: string, props: VpcModuleProps) {
    super(scope, id);

    // Si no se reciben subnets por props, se usa el baseline de 3 /24 privados.
    const subnetCidrs = props.privateSubnetCidrs ?? ['10.0.1.0/24', '10.0.2.0/24', '10.0.3.0/24'];

    // Guard clause: este módulo exige 3 subnets privadas para mantener el diseño estándar.
    if (subnetCidrs.length !== 3) {
      throw new Error('[VpcModule] Debes definir exactamente 3 CIDRs para privateSubnetCidrs.');
    }

    // Asigna una AZ por subnet para distribuir recursos de forma balanceada.
    const availabilityZones = subnetCidrs.map((_, index) => Fn.select(index, Fn.getAzs()));

    // VPC base privada con DNS habilitado para resolución interna.
    const cfnVpc = new ec2.CfnVPC(this, 'MainVpc', {
      cidrBlock: props.cidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: [{ key: 'Name', value: props.vpcName }],
    });

    // Crea 3 subnets privadas (una por AZ) y aplica tags consistentes por ambiente.
    const privateSubnetResources = subnetCidrs.map(
      (subnetCidr, index) =>
        new ec2.CfnSubnet(this, `PrivateSubnet${index + 1}`, {
          vpcId: cfnVpc.ref,
          cidrBlock: subnetCidr,
          availabilityZone: availabilityZones[index],
          mapPublicIpOnLaunch: false,
          tags: [{ key: 'Name', value: `${props.vpcName}-private-${index + 1}` }],
        }),
    );

    // Crea una route table dedicada por subnet para aislar rutas por segmento.
    const routeTableResources = privateSubnetResources.map(
      (_, index) =>
        new ec2.CfnRouteTable(this, `PrivateRouteTable${index + 1}`, {
          vpcId: cfnVpc.ref,
          tags: [{ key: 'Name', value: `${props.vpcName}-rt-private-${index + 1}` }],
        }),
    );

    // Relaciona 1:1 cada subnet con su route table privada.
    privateSubnetResources.forEach((subnet, index) => {
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetAssociation${index + 1}`, {
        subnetId: subnet.ref,
        routeTableId: routeTableResources[index].ref,
      });
    });

    // Expone subnets como ISubnet para consumo desde otros módulos sin acoplarse a Cfn*.
    this.privateSubnets = privateSubnetResources.map((subnet, index) =>
      ec2.Subnet.fromSubnetAttributes(this, `PrivateSubnetRef${index + 1}`, {
        subnetId: subnet.ref,
        availabilityZone: availabilityZones[index],
        routeTableId: routeTableResources[index].ref,
      }),
    );

    // Expone la VPC como IVpc para que otros módulos puedan adjuntar recursos de red.
    this.vpc = ec2.Vpc.fromVpcAttributes(this, 'MainVpcRef', {
      vpcId: cfnVpc.ref,
      vpcCidrBlock: props.cidr,
      availabilityZones,
      privateSubnetIds: privateSubnetResources.map((subnet) => subnet.ref),
      privateSubnetRouteTableIds: routeTableResources.map((routeTable) => routeTable.ref),
    });

    // Interface Endpoint para Secrets Manager: permite a las lambdas dentro
    // de la VPC privada llegar a la API de SM sin pasar por internet/NAT.
    // Configurado en una sola AZ para ahorrar costo (~$7/mes vs ~$15/mes en 2 AZ).
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnets: [this.privateSubnets[0]!] },
    });

    // Gateway Endpoint para DynamoDB: ruta en las route tables de la VPC.
    // Es gratis (no cobra ni por hora ni por GB), no requiere ENIs ni SG.
    this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });
  }
}
