#!/usr/bin/env node
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface VpcModuleProps {
  /** Nombre de la VPC en AWS (tag Name). */
  readonly vpcName: string;

  /** CIDR principal de la VPC. */
  readonly cidr: string;

  /** CIDRs de las 2 subnets privadas. */
  readonly privateSubnetCidrs?: string[];

  /** CIDRs de las 2 subnets públicas. */
  readonly publicSubnetCidrs?: string[];
}

/**
 * Modulo de networking completo.
 *
 * Crea una VPC con NAT Gateway, Internet Gateway, 2 subnets privadas,
 * 2 subnets públicas, route tables compartidas y security groups específicos.
 */
export class VpcModule extends Construct {
  /** Referencia reutilizable de la VPC para otros módulos/stacks. */
  public readonly vpc: ec2.IVpc;

  /** Lista de subnets privadas creadas por el módulo. */
  public readonly privateSubnets: ec2.ISubnet[];

  /** Lista de subnets públicas creadas por el módulo. */
  public readonly publicSubnets: ec2.ISubnet[];

  /** Internet Gateway para conectividad pública. */
  public readonly internetGateway: ec2.CfnInternetGateway;

  /** NAT Gateway para conectividad saliente desde subnets privadas. */
  public readonly natGateway: ec2.CfnNatGateway;

  /** Elastic IP para el NAT Gateway. */
  public readonly elasticIp: ec2.CfnEIP;

  /** Security Group por defecto para recursos internos. */
  public readonly defaultSecurityGroup: ec2.ISecurityGroup;

  /** Security Group para recursos públicos (Internet Gateway). */
  public readonly publicSecurityGroup: ec2.ISecurityGroup;

  /** Security Group para recursos NAT Gateway. */
  public readonly natSecurityGroup: ec2.ISecurityGroup;

  /** Route table pública compartida. */
  public readonly publicRouteTable: ec2.CfnRouteTable;

  /** Route table privada compartida. */
  public readonly privateRouteTable: ec2.CfnRouteTable;

    /** Parámetro SSM con los IDs de las subnets privadas. */
  public readonly privateSubnetIdsParameter: ssm.IStringListParameter;

  constructor(scope: Construct, id: string, props: VpcModuleProps) {
    super(scope, id);

    // CIDRs por defecto para 2 subnets privadas y 2 públicas
    const privateSubnetCidrs = props.privateSubnetCidrs ?? ['10.0.1.0/24', '10.0.2.0/24'];
    const publicSubnetCidrs = props.publicSubnetCidrs ?? ['10.0.101.0/24', '10.0.102.0/24'];

    // Guard clauses: este módulo exige 2 subnets de cada tipo
    if (privateSubnetCidrs.length !== 2) {
      throw new Error('[VpcModule] Debes definir exactamente 2 CIDRs para privateSubnetCidrs.');
    }
    if (publicSubnetCidrs.length !== 2) {
      throw new Error('[VpcModule] Debes definir exactamente 2 CIDRs para publicSubnetCidrs.');
    }

    // Asigna una AZ por subnet para distribuir recursos de forma balanceada
    const availabilityZones = [0, 1].map(index => Fn.select(index, Fn.getAzs()));

    // VPC base con DNS habilitado para resolución interna
    const cfnVpc = new ec2.CfnVPC(this, 'MainVpc', {
      cidrBlock: props.cidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: [{ key: 'Name', value: props.vpcName }],
    });

    // Internet Gateway para conectividad pública
    this.internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway', {
      tags: [{ key: 'Name', value: `${props.vpcName}-igw` }],
    });

    // Adjunta el Internet Gateway a la VPC
    new ec2.CfnVPCGatewayAttachment(this, 'VpcGatewayAttachment', {
      vpcId: cfnVpc.ref,
      internetGatewayId: this.internetGateway.ref,
    });

    // Crea subnets públicas con letras mayúsculas
    const publicSubnetResources = publicSubnetCidrs.map(
      (subnetCidr, index) => {
        const letter = String.fromCharCode(65 + index); // 65 = 'A' en ASCII
        return new ec2.CfnSubnet(this, `PublicSubnet${letter}`, {
          vpcId: cfnVpc.ref,
          cidrBlock: subnetCidr,
          availabilityZone: availabilityZones[index],
          mapPublicIpOnLaunch: true,
          tags: [{ key: 'Name', value: `${props.vpcName}-public-${letter}` }],
        });
      }
    );

    // Crea 2 subnets privadas
    // Crea subnets privadas con letras mayúsculas
    const privateSubnetResources = privateSubnetCidrs.map(
      (subnetCidr, index) => {
        const letter = String.fromCharCode(65 + index); // 65 = 'A' en ASCII
        return new ec2.CfnSubnet(this, `PrivateSubnet${letter}`, {
          vpcId: cfnVpc.ref,
          cidrBlock: subnetCidr,
          availabilityZone: availabilityZones[index],
          mapPublicIpOnLaunch: false,
          tags: [{ key: 'Name', value: `${props.vpcName}-private-${letter}` }],
        });
      }
    );

    // Parámetro StringList con los IDs de las subnets privadas
    this.privateSubnetIdsParameter = new ssm.StringListParameter(this, 'PrivateSubnetIdsParameter', {
      parameterName: '/skorify/prod/private-subnet-ids',
      stringListValue: privateSubnetResources.map((subnet) => subnet.ref),
      description: 'IDs de las subnets privadas de la VPC',
    });

    // Elastic IP para el NAT Gateway
    this.elasticIp = new ec2.CfnEIP(this, 'NatGatewayEIP', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: `${props.vpcName}-nat-eip` }],
    });

    // NAT Gateway en la primera subnet pública
    this.natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
      subnetId: publicSubnetResources[0].ref,
      allocationId: this.elasticIp.attrAllocationId,
      tags: [{ key: 'Name', value: `${props.vpcName}-nat-gw` }],
    });

    // ===== ROUTE TABLES (UNA PÚBLICA Y UNA PRIVADA) =====

    // Route table pública compartida para ambas subnets públicas
    this.publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: cfnVpc.ref,
      tags: [{ key: 'Name', value: `${props.vpcName}-rt-public` }],
    });

    // Route table privada compartida para ambas subnets privadas
    this.privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: cfnVpc.ref,
      tags: [{ key: 'Name', value: `${props.vpcName}-rt-private` }],
    });

    // Ruta por defecto hacia Internet Gateway para subnets públicas
    new ec2.CfnRoute(this, 'PublicDefaultRoute', {
      routeTableId: this.publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: this.internetGateway.ref,
    });

    // Ruta por defecto hacia NAT Gateway para subnets privadas
    new ec2.CfnRoute(this, 'PrivateDefaultRoute', {
      routeTableId: this.privateRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: this.natGateway.ref,
    });

    // Asocia ambas subnets públicas con la route table pública
    publicSubnetResources.forEach((subnet, index) => {
      const letter = String.fromCharCode(65 + index); // A, B
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetAssociation${letter}`, {
        subnetId: subnet.ref,
        routeTableId: this.publicRouteTable.ref,
      });
    });

    // Asocia ambas subnets privadas con la route table privada
    privateSubnetResources.forEach((subnet, index) => {
      const letter = String.fromCharCode(65 + index); // A, B
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetAssociation${letter}`, {
        subnetId: subnet.ref,
        routeTableId: this.privateRouteTable.ref,
      });
    });

    // ===== SECURITY GROUPS =====

    // Security Group por defecto para recursos internos
    const defaultSg = new ec2.CfnSecurityGroup(this, 'DefaultSecurityGroup', {
      groupDescription: 'Security group por defecto para recursos internos',
      vpcId: cfnVpc.ref,
      securityGroupEgress: [
        {
          ipProtocol: '-1',
          cidrIp: '0.0.0.0/0',
          description: 'Permitir todo el trafico saliente',
        },
      ],
      tags: [{ key: 'Name', value: `${props.vpcName}-default-sg` }],
    });

    // Configura la regla de ingreso para permitir tráfico desde el mismo SG
    new ec2.CfnSecurityGroupIngress(this, 'DefaultSgSelfIngress', {
      groupId: defaultSg.ref,
      ipProtocol: '-1',
      sourceSecurityGroupId: defaultSg.ref,
      description: 'Permitir todo el trafico desde el mismo security group',
    });

    // Security Group para recursos públicos (Internet Gateway)
    const publicSg = new ec2.CfnSecurityGroup(this, 'PublicSecurityGroup', {
      groupDescription: 'Security group para recursos con acceso publico a Internet',
      vpcId: cfnVpc.ref,
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrIp: '0.0.0.0/0',
          description: 'HTTP desde Internet',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrIp: '0.0.0.0/0',
          description: 'HTTPS desde Internet',
        },
      ],
      securityGroupEgress: [
        {
          ipProtocol: '-1',
          cidrIp: '0.0.0.0/0',
          description: 'Permitir todo el trafico saliente',
        },
      ],
      tags: [{ key: 'Name', value: `${props.vpcName}-public-sg` }],
    });

    // Security Group para NAT Gateway
    const natSg = new ec2.CfnSecurityGroup(this, 'NatSecurityGroup', {
      groupDescription: 'Security group para NAT Gateway - trafico saliente desde subnets privadas',
      vpcId: cfnVpc.ref,
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrIp: props.cidr,
          description: 'HTTP desde VPC',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrIp: props.cidr,
          description: 'HTTPS desde VPC',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 1024,
          toPort: 65535,
          cidrIp: props.cidr,
          description: 'Puertos efimeros desde VPC',
        },
      ],
      securityGroupEgress: [
        {
          ipProtocol: '-1',
          cidrIp: '0.0.0.0/0',
          description: 'Permitir todo el trafico saliente a Internet',
        },
      ],
      tags: [{ key: 'Name', value: `${props.vpcName}-nat-sg` }],
    });

    // ===== EXPOSICIÓN DE RECURSOS =====

    // Expone subnets públicas como ISubnet
    this.publicSubnets = publicSubnetResources.map((subnet, index) => {
      const letter = String.fromCharCode(65 + index); // A, B
      return ec2.Subnet.fromSubnetAttributes(this, `PublicSubnetRef${letter}`, {
        subnetId: subnet.ref,
        availabilityZone: availabilityZones[index],
        routeTableId: this.publicRouteTable.ref,
      });
    });

    // Expone subnets privadas como ISubnet
    this.privateSubnets = privateSubnetResources.map((subnet, index) => {
      const letter = String.fromCharCode(65 + index); // A, B
      return ec2.Subnet.fromSubnetAttributes(this, `PrivateSubnetRef${letter}`, {
        subnetId: subnet.ref,
        availabilityZone: availabilityZones[index],
        routeTableId: this.privateRouteTable.ref,
      });
    });

    // Expone los security groups
    this.defaultSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'DefaultSecurityGroupRef',
      defaultSg.ref,
    );

    this.publicSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'PublicSecurityGroupRef',
      publicSg.ref,
    );

    this.natSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'NatSecurityGroupRef',
      natSg.ref,
    );

    // Expone la VPC como IVpc para que otros módulos puedan adjuntar recursos de red
    this.vpc = ec2.Vpc.fromVpcAttributes(this, 'MainVpcRef', {
      vpcId: cfnVpc.ref,
      vpcCidrBlock: props.cidr,
      availabilityZones,
      publicSubnetIds: publicSubnetResources.map((subnet) => subnet.ref),
      privateSubnetIds: privateSubnetResources.map((subnet) => subnet.ref),
      publicSubnetRouteTableIds: [this.publicRouteTable.ref, this.publicRouteTable.ref],
      privateSubnetRouteTableIds: [this.privateRouteTable.ref, this.privateRouteTable.ref],
    });
  }
}
