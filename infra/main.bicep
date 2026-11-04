// Tomekeeper on Azure, for the test month: one App Service for the site and the API, PostgreSQL, email through
// Azure Communication Services, and a budget alert. Everything is in one resource group, so taking it down is
// deleting that group. The steps are in docs/azure.md.
//
//   az deployment group create --resource-group rg-tomekeeper --template-file infra/main.bicep \
//     --parameters ownerName='<your name>' ownerEmail=<you@example.com> dbAdminPassword=<password>

targetScope = 'resourceGroup'

@description('Where everything runs. The resource group is created in Norway East.')
param location string = resourceGroup().location

@description('The start of every resource name.')
@minLength(3)
@maxLength(12)
param name string = 'tomekeeper'

@description('Gets the budget alerts and the reports readers send, and is the contact address in the privacy policy and accessibility statement.')
param ownerEmail string

@description('Who runs the site, as the privacy policy names them.')
param ownerName string

@description('The PostgreSQL administrator password: 8 to 128 characters from at least three of upper case, lower case, digits and symbols. Avoid ; and quotes, which end a connection string.')
@secure()
@minLength(8)
param dbAdminPassword string

@description('The monthly budget for the resource group, in the billing currency (NOK for a Norwegian account). Alerts at 50 and 100 percent.')
param budgetAmount int = 100

@description('The first day of the month the budget starts.')
param budgetStartDate string = utcNow('yyyy-MM-01')

@description('Google sign-in (optional): the client id. Add https://<app>.azurewebsites.net/api/account/google/callback to the client in Google Cloud first.')
param googleClientId string = ''

@description('Google sign-in (optional): the client secret.')
@secure()
param googleClientSecret string = ''

@description('Open Library asks apps for a contact address in the User-Agent header (optional).')
param openLibraryContactEmail string = ''

// Web app and database server names are global, so a short hash of the resource group makes them unique.
var suffix = take(uniqueString(resourceGroup().id), 6)
var appName = '${name}-${suffix}'
var communicationName = '${name}-${suffix}-acs'

module database 'modules/database.bicep' = {
  name: 'database'
  params: {
    location: location
    serverName: '${name}-db-${suffix}'
    adminPassword: dbAdminPassword
  }
}

module email 'modules/email.bicep' = {
  name: 'email'
  params: {
    emailServiceName: '${name}-${suffix}-email'
    communicationName: communicationName
  }
}

// Read the connection string here rather than passing it out of the module, so it never appears in deployment outputs.
resource communication 'Microsoft.Communication/communicationServices@2023-04-01' existing = {
  name: communicationName
}

module app 'modules/app.bicep' = {
  name: 'app'
  // Waits for the email module (it uses its sender address), so the communication service exists when its key is read.
  params: {
    location: location
    appName: appName
    planName: '${name}-plan-${suffix}'
    databaseConnectionString: 'Host=${database.outputs.host};Database=${database.outputs.databaseName};Username=${database.outputs.adminLogin};Password=${dbAdminPassword};Ssl Mode=VerifyFull'
    emailConnectionString: communication.listKeys().primaryConnectionString
    emailSender: 'DoNotReply@${email.outputs.senderDomain}'
    moderatorEmail: ownerEmail
    operatorName: ownerName
    contactEmail: ownerEmail
    googleClientId: googleClientId
    googleClientSecret: googleClientSecret
    openLibraryContactEmail: openLibraryContactEmail
  }
}

module budget 'modules/budget.bicep' = {
  name: 'budget'
  params: {
    name: '${name}-budget'
    amount: budgetAmount
    startDate: budgetStartDate
    contactEmail: ownerEmail
  }
}

@description('The address of the site.')
output siteUrl string = app.outputs.url

@description('The web app name, for the deploy workflow (AZURE_WEBAPP_NAME).')
output webAppName string = appName

@description('The address emails are sent from.')
output emailSender string = 'DoNotReply@${email.outputs.senderDomain}'
