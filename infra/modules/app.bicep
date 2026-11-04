// The App Service: a free (F1) Linux plan and the web app running the API, which also serves the built
// front-end (see "Running on Azure" in the README). The settings here are read by the API as configuration.

param location string
param appName string
param planName string

@secure()
param databaseConnectionString string

@secure()
param emailConnectionString string

param emailSender string
param moderatorEmail string
param operatorName string
param contactEmail string
param googleClientId string

@secure()
param googleClientSecret string

param openLibraryContactEmail string

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: 'F1'
    tier: 'Free'
  }
  properties: {
    reserved: true // Linux
  }
}

var baseSettings = [
  { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
  { name: 'App__PublicUrl', value: 'https://${appName}.azurewebsites.net' }
  { name: 'App__BehindProxy', value: 'true' }
  { name: 'App__ModeratorEmail', value: moderatorEmail }
  // Shown in the privacy policy and accessibility statement (GET /api/site).
  { name: 'App__OperatorName', value: operatorName }
  { name: 'App__ContactEmail', value: contactEmail }
  { name: 'Database__MigrateOnStartup', value: 'true' }
  // /home is the app's own storage, kept across restarts and deploys.
  { name: 'DataProtection__KeysPath', value: '/home/data-protection-keys' }
  { name: 'Email__AzureConnectionString', value: emailConnectionString }
  { name: 'Email__Sender', value: emailSender }
]
var googleSettings = empty(googleClientId) ? [] : [
  { name: 'Authentication__Google__ClientId', value: googleClientId }
  { name: 'Authentication__Google__ClientSecret', value: googleClientSecret }
]
var openLibrarySettings = empty(openLibraryContactEmail) ? [] : [
  { name: 'OpenLibrary__ContactEmail', value: openLibraryContactEmail }
]

resource site 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      // The deploy workflow sends the published API (with the front-end in wwwroot); this is how it starts.
      appCommandLine: 'dotnet Tomekeeper.Api.dll'
      alwaysOn: false // not on the free plan: the app sleeps when idle and wakes on the next visit
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: concat(baseSettings, googleSettings, openLibrarySettings)
      connectionStrings: [
        {
          // Read by the API as ConnectionStrings:Tomekeeper.
          name: 'Tomekeeper'
          connectionString: databaseConnectionString
          type: 'Custom'
        }
      ]
    }
  }
}

// The app's console output (what `dotnet run` prints locally), kept for three days, so
// `az webapp log tail` and the portal's log stream show it.
resource logs 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: site
  name: 'logs'
  properties: {
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 3
        retentionInMb: 35
      }
    }
  }
}

// Deploys sign in with Microsoft Entra (the GitHub workflow uses OIDC), so the old username-and-password
// publishing is switched off.
resource scmBasicAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: site
  name: 'scm'
  properties: {
    allow: false
  }
}

resource ftpBasicAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: site
  name: 'ftp'
  properties: {
    allow: false
  }
}

output url string = 'https://${site.properties.defaultHostName}'
