// Jenkins REST API response types

export interface JenkinsJob {
    _class?: string;
    name: string;
    fullName?: string;
    url: string;
    color?: string;
    description?: string;
    displayName?: string;
    buildable?: boolean;
    builds?: JenkinsBuild[];
    lastBuild?: JenkinsBuild | null;
    lastSuccessfulBuild?: JenkinsBuild | null;
    lastFailedBuild?: JenkinsBuild | null;
    healthReport?: JenkinsHealthReport[];
    property?: JenkinsJobProperty[];
    scm?: JenkinsScm;
    actions?: JenkinsAction[];
    jobs?: JenkinsJob[]; // For folders
    [key: string]: unknown;
}

export interface JenkinsBuild {
    _class?: string;
    number: number;
    url: string;
    result?: string | null;
    timestamp?: number;
    duration?: number;
    displayName?: string;
    description?: string;
    building?: boolean;
    changeSets?: JenkinsChangeSet[];
    actions?: JenkinsAction[];
    [key: string]: unknown;
}

export interface JenkinsHealthReport {
    description: string;
    iconClassName: string;
    iconUrl: string;
    score: number;
}

export interface JenkinsJobProperty {
    _class?: string;
    parameterDefinitions?: JenkinsParameterDefinition[];
    [key: string]: unknown;
}

export interface JenkinsParameterDefinition {
    _class?: string;
    name: string;
    description?: string;
    type: string;
    defaultParameterValue?: {
        _class?: string;
        name: string;
        value: unknown;
    };
    choices?: string[];
}

export interface JenkinsQueueItem {
    _class?: string;
    id: number;
    url?: string;
    why?: string;
    blocked?: boolean;
    buildable?: boolean;
    cancelled?: boolean;
    stuck?: boolean;
    executable?: {
        _class?: string;
        number: number;
        url: string;
    };
    task?: {
        _class?: string;
        name: string;
        url: string;
    };
    actions?: JenkinsAction[];
    inQueueSince?: number;
    [key: string]: unknown;
}

export interface JenkinsScm {
    _class?: string;
    userRemoteConfigs?: Array<{
        url?: string;
        credentialsId?: string;
    }>;
    branches?: Array<{
        name?: string;
    }>;
    [key: string]: unknown;
}

export interface JenkinsAction {
    _class?: string;
    remoteUrls?: string[];
    lastBuiltRevision?: {
        SHA1?: string;
        branch?: Array<{
            SHA1?: string;
            name?: string;
        }>;
    };
    buildsByBranchName?: Record<string, {
        buildNumber: number;
        buildResult?: string;
        revision?: {
            SHA1?: string;
            branch?: Array<{
                SHA1?: string;
                name?: string;
            }>;
        };
    }>;
    [key: string]: unknown;
}

export interface JenkinsChangeSet {
    _class?: string;
    items: JenkinsChangeSetItem[];
    kind?: string;
}

export interface JenkinsChangeSetItem {
    _class?: string;
    author: {
        absoluteUrl?: string;
        fullName: string;
    };
    commitId?: string;
    timestamp?: number;
    msg: string;
    comment?: string;
    affectedPaths?: string[];
    paths?: Array<{
        editType: string;
        file: string;
    }>;
}

export interface JenkinsTestResult {
    _class?: string;
    duration?: number;
    empty?: boolean;
    failCount: number;
    passCount: number;
    skipCount: number;
    suites?: JenkinsTestSuite[];
    [key: string]: unknown;
}

export interface JenkinsTestSuite {
    _class?: string;
    name: string;
    duration?: number;
    cases: JenkinsTestCase[];
}

export interface JenkinsTestCase {
    _class?: string;
    name: string;
    className: string;
    duration?: number;
    status: string;
    errorDetails?: string | null;
    errorStackTrace?: string | null;
    stdout?: string | null;
    stderr?: string | null;
    skipped?: boolean;
    skippedMessage?: string | null;
    failedSince?: number;
    age?: number;
}

export interface JenkinsComputerSet {
    _class?: string;
    busyExecutors: number;
    totalExecutors: number;
    computer: JenkinsComputer[];
}

export interface JenkinsComputer {
    _class?: string;
    displayName: string;
    idle: boolean;
    offline: boolean;
    temporarilyOffline: boolean;
    numExecutors: number;
}

export interface JenkinsQueue {
    _class?: string;
    items: JenkinsQueueItem[];
}

export interface JenkinsUser {
    _class?: string;
    fullName: string;
    id?: string;
    absoluteUrl?: string;
    [key: string]: unknown;
}

export interface JenkinsRootInfo {
    _class?: string;
    jobs: JenkinsJob[];
    primaryView?: { name: string; url: string };
    quietingDown?: boolean;
    url?: string;
    nodeDescription?: string;
    numExecutors?: number;
    [key: string]: unknown;
}
