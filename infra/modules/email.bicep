// Email through Azure Communication Services, from an Azure-managed domain (xxxx.azurecomm.net). No DNS to set up.
// Such a domain may send a limited number of emails an hour, which is plenty for a test month. The data stays in
// Europe; the email service and the communication service must have the same data location to be linked.

param emailServiceName string
param communicationName string

var dataLocation = 'Europe'

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: emailServiceName
  location: 'global'
  properties: {
    dataLocation: dataLocation
  }
}

resource domain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    // No tracking pixels or rewritten links in Tomekeeper's emails.
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationName
  location: 'global'
  properties: {
    dataLocation: dataLocation
    linkedDomains: [
      domain.id
    ]
  }
}

output senderDomain string = domain.properties.mailFromSenderDomain
