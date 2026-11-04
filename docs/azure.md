# Tomekeeper on Azure

For the test month (stage 6), Tomekeeper runs on Azure in one resource group in Norway East:

| Resource | What | Cost on a free account |
| --- | --- | --- |
| App Service plan, F1 (Linux) | Runs the API, which also serves the site | Free |
| Web app (.NET 10) | `https://tomekeeper-xxxxxx.azurewebsites.net` | Free |
| PostgreSQL Flexible Server, Burstable B1ms, 32 GB, PostgreSQL 18 | The database | Free for 12 months on a new account |
| Communication Services and Email (Azure-managed domain) | Account emails and reports to the moderator | A fraction of a krone for a month |
| Budget | Emails at 50 and 100 percent of 100 kr a month, and when Azure forecasts 100 | Free |

The infrastructure is described in [infra/main.bicep](../infra/main.bicep) and its modules. Taking it all down is deleting the resource group.

The free App Service plan sleeps when nobody has visited for a while, so the first visit after a pause takes some seconds. It also has 60 minutes of processor time a day, which is plenty for trying the site.

> **Do it all in one sitting, when you have an hour.** The free account's 200 USD credit lasts 30 days from sign-up, so create the account only when you are ready to go through all the steps below. Commands are for the Mac's Terminal, run from the repository folder.

## 1. The Azure account

1. Create a free account at https://azure.microsoft.com/free (a card and a phone number are needed to prove who you are; nothing is charged unless you upgrade).
2. Install the Azure CLI on the Mac and sign in:

   ```sh
   brew install azure-cli
   az login
   ```

3. Let the subscription use the services Tomekeeper needs (only needed once, on a new subscription):

   ```sh
   for ns in Microsoft.Web Microsoft.DBforPostgreSQL Microsoft.Communication Microsoft.Consumption; do
     az provider register --namespace $ns
   done
   ```

## 2. The infrastructure

From the repository folder:

```sh
az group create --name rg-tomekeeper --location norwayeast

# A database password with upper case, lower case, digits and a symbol. It goes straight into the app's
# settings; you don't need to keep it (it can be reset in the portal).
DB_PASSWORD="Tk-$(openssl rand -hex 20)"

az deployment group create \
  --resource-group rg-tomekeeper \
  --template-file infra/main.bicep \
  --parameters ownerName='<your name>' ownerEmail=<your email> dbAdminPassword="$DB_PASSWORD"
```

`ownerName` and `ownerEmail` are shown in the privacy policy and accessibility statement as who runs the site and where to write; they are settings on Azure, not in the repository. `ownerEmail` also gets the budget alerts and the reports readers send. Optional parameters: `budgetAmount` (100 by default, in the account's currency), `googleClientId` and `googleClientSecret` for Google sign-in (first add `https://<web app>.azurewebsites.net/api/account/google/callback` as a redirect URI on the client in Google Cloud), and `openLibraryContactEmail`.

The deployment takes 5 to 10 minutes (the database is the slow part). At the end it prints `siteUrl`, `webAppName` and `emailSender`. Until the app is deployed (step 4), the address shows Azure's placeholder page.

Running the same command again updates what changed. In a later month, add `budgetStartDate=<the first day of the month the budget started, as yyyy-MM-01>`, since a budget's start date can't be changed.

## 3. Letting GitHub deploy

The workflow [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) signs in to Azure with a short-lived token from GitHub (OIDC), so no Azure password or key is stored in GitHub. Azure trusts the token because of a *federated credential* on an app registration, and only from this repository's `azure` environment. The registration may only deploy to the web app (the role *Website Contributor* on it, nothing else).

```sh
# The web app's name, from the deployment's output (webAppName).
WEB_APP=<web app name>

APP_ID=$(az ad app create --display-name tomekeeper-deploy --query appId --output tsv)
az ad sp create --id "$APP_ID"
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-azure-environment",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:alexandermora1/tomekeeper:environment:azure",
  "audiences": ["api://AzureADTokenExchange"]
}'
az role assignment create --assignee "$APP_ID" --role "Website Contributor" \
  --scope "$(az webapp show --resource-group rg-tomekeeper --name "$WEB_APP" --query id --output tsv)"

# The four values the workflow needs. None of them is a secret.
echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId --output tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id --output tsv)"
echo "AZURE_WEBAPP_NAME=$WEB_APP"
```

On GitHub, open the repository's **Settings → Secrets and variables → Actions → Variables** and add the four as *repository variables* with those names. (With the GitHub CLI: `gh variable set AZURE_CLIENT_ID --body "$APP_ID"`, and so on.)

## 4. Deploying

On GitHub, open **Actions → Deploy to Azure → Run workflow**. It builds the front-end, puts it in the API, publishes and deploys it, then waits until `/api/health/ready` answers (up to five minutes; the first start creates the database tables). The first run also creates the `azure` environment in the repository settings. When it is done, the run's summary links to the site.

Deploy again the same way after each change you want on Azure.

## 5. The month on Azure

Things to try, as a reader would:

- Sign up with email. The confirmation email comes from the `emailSender` address; look in the spam folder too.
- Ask for a password reset, and use the link.
- Sign in with Google, if you gave the Google parameters.
- Find books (Open Library), shelve them, log progress, and check the chronicle, the Twelve Labours and the quests.
- Make a second account in a private window: friends, reviews, "See your profile as", blocking, and a report (it is emailed to `ownerEmail`).
- Dark theme, Plain script, a phone, a screen reader.

Keeping an eye on it:

- The app's log: `az webapp log tail --resource-group rg-tomekeeper --name <web app name>`, or **Log stream** on the web app in the portal.
- Costs: **Cost Management → Cost analysis** for the resource group. The budget emails you if it passes 50 kr.
- The free plan sleeps when idle; the first visit after a pause is slow. That is the plan, not a fault.

## Taking it down

```sh
az group delete --name rg-tomekeeper
az ad app delete --id <AZURE_CLIENT_ID>
```

The first deletes everything in the resource group, the data with it; the second deletes the app registration that let GitHub deploy. Then remove the four variables (and the `azure` environment) on GitHub. On a free account, nothing is charged afterwards unless you upgrade it.
