export type RobotGModel = 'RN' | 'RNE' | 'RV' | 'RXMHEV'
export type RobotGSubAssyProcess = 'SS.H' | 'SS.M' | 'SPW.1' | 'SS.G' | 'SS.D'
export type RobotGLineProcess = RobotGSubAssyProcess | 'RB.G' | 'TANDUM' | 'SUPPLIER'

export interface RobotGSubAssy {
  process: RobotGSubAssyProcess
  partNumber: string
  packaging: number
  maxStore: number
}

export interface RobotGAssy {
  model: RobotGModel
  partNumber: string
  packaging: number
  maxStore: number
  subAssemblies: RobotGSubAssy[]
  pressParts: Array<{
    process: RobotGLineProcess
    partNumber: string
    packaging: number
  }>
}

function subAssy(
  process: RobotGSubAssyProcess,
  partNumber: string,
  packaging: number,
  maxStore: number,
): RobotGSubAssy {
  return { process, partNumber, packaging, maxStore }
}

function pressPart(
  process: RobotGLineProcess,
  partNumber: string,
  packaging: number,
) {
  return { process, partNumber, packaging }
}

export const robotGComposition: RobotGAssy[] = [
  {
    model: 'RN',
    partNumber: '5220BA42',
    packaging: 39,
    maxStore: 312,
    subAssemblies: [
      subAssy('SS.H', '5220K814', 35, 140),
      subAssy('SS.M', '50162B000P', 70, 280),
      subAssy('SPW.1', '5220AU52', 35, 315),
      subAssy('SS.G', '5220K826', 35, 315),
      subAssy('SS.D', '5220BA53', 35, 210),
    ],
    pressParts: [
      pressPart('SS.H', '5220K816', 50),
      pressPart('SS.M', '50162E060P', 90),
      pressPart('SPW.1', '5220AU54', 40),
      pressPart('TANDUM', '5220K810', 50),
      pressPart('SS.G', '5220K828', 30),
      pressPart('SS.D', '5220BA54', 40),
    ],
  },
  {
    model: 'RN',
    partNumber: '5220AU50',
    packaging: 39,
    maxStore: 312,
    subAssemblies: [
      subAssy('SS.H', '5220K814', 35, 140),
      subAssy('SS.M', '50162B000P', 70, 280),
      subAssy('SPW.1', '5220AU52', 35, 315),
      subAssy('SS.G', '5220K826', 35, 315),
      subAssy('SS.D', '5220K836', 35, 315),
    ],
    pressParts: [
      pressPart('SS.H', '5220K816', 50),
      pressPart('SS.M', '50162E060P', 90),
      pressPart('SPW.1', '5220AU54', 40),
      pressPart('TANDUM', '5220K810', 50),
      pressPart('SS.G', '5220K828', 30),
      pressPart('SS.D', '5220K837', 40),
    ],
  },
  {
    model: 'RNE',
    partNumber: '75114W000P',
    packaging: 35,
    maxStore: 280,
    subAssemblies: [
      subAssy('SS.H', '50120W000P', 35, 140),
      subAssy('SS.M', '50162B000P', 70, 280),
      subAssy('SPW.1', '751B8W000P', 35, 315),
      subAssy('SS.G', '5220K826', 35, 315),
      subAssy('SS.D', '5220BA53', 35, 210),
    ],
    pressParts: [
      pressPart('SS.H', '50122W000P', 50),
      pressPart('SS.M', '50162E060P', 90),
      pressPart('SPW.1', '751C4W010P', 30),
      pressPart('TANDUM', '5220K810', 50),
      pressPart('SS.G', '5220K828', 30),
      pressPart('SS.D', '5220BA54', 40),
    ],
  },
  {
    model: 'RV',
    partNumber: '75110B000P',
    packaging: 25,
    maxStore: 200,
    subAssemblies: [
      subAssy('SS.H', '5220K814', 35, 140),
      subAssy('SS.M', '50162B000P', 70, 280),
      subAssy('SPW.1', '5220AU52', 35, 315),
      subAssy('SS.G', '5220K826', 35, 315),
      subAssy('SS.D', '75130C000P', 25, 150),
    ],
    pressParts: [
      pressPart('SS.H', '5220K816', 50),
      pressPart('SS.M', '50162E060P', 90),
      pressPart('SPW.1', '5220AU54', 40),
      pressPart('TANDUM', '5220K810', 50),
      pressPart('SS.G', '5220K828', 30),
      pressPart('SS.D', '75134C000P', 20),
    ],
  },
  {
    model: 'RXMHEV',
    partNumber: '75110C000P',
    packaging: 25,
    maxStore: 200,
    subAssemblies: [
      subAssy('SS.H', '50120W000P', 35, 140),
      subAssy('SS.M', '50162B000P', 70, 280),
      subAssy('SPW.1', '751B8W000P', 35, 315),
      subAssy('SS.G', '5220K826', 35, 315),
      subAssy('SS.D', '75130C000P', 25, 150),
    ],
    pressParts: [
      pressPart('SS.H', '50122W000P', 50),
      pressPart('SS.M', '50162E060P', 90),
      pressPart('SPW.1', '751C4W010P', 30),
      pressPart('TANDUM', '5220K810', 50),
      pressPart('SS.G', '5220K828', 30),
      pressPart('SS.D', '75134C000P', 20),
    ],
  },
]

export const robotGSubAssyProcesses: RobotGSubAssyProcess[] = [
  'SS.H',
  'SS.M',
  'SPW.1',
  'SS.G',
  'SS.D',
]

export function getRobotGSubAssyProcess(partNumber: string): RobotGSubAssyProcess | undefined {
  return robotGComposition
    .flatMap((assy) => assy.subAssemblies)
    .find((subAssyPart) => subAssyPart.partNumber === partNumber)?.process
}

export function getRobotGPartProcess(partNumber: string): RobotGLineProcess | undefined {
  if (robotGComposition.some((assy) => assy.partNumber === partNumber)) return 'RB.G'
  const subAssyProcess = getRobotGSubAssyProcess(partNumber)
  if (subAssyProcess) return subAssyProcess
  const pressProcess = robotGComposition
    .flatMap((assy) => assy.pressParts)
    .find((part) => part.partNumber === partNumber)?.process
  if (pressProcess) return pressProcess
  return partNumber === '4650C745' ? 'SUPPLIER' : undefined
}

export function isRobotGQueuePart(partNumber: string, type: 'Assy' | 'Sub Assy'): boolean {
  if (type === 'Assy') {
    return robotGComposition.some((assy) => assy.partNumber === partNumber)
  }
  return robotGComposition.some((assy) =>
    assy.subAssemblies.some((subAssyPart) => subAssyPart.partNumber === partNumber),
  )
}
