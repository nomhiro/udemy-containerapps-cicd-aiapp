### リソース払い出し

```powershell
az login
az account show
```

```powershell
azd auth login
```

```powershell
(.venv) AzureContainerApps\src > azd up
? Enter a unique environment name: todoapp

New environment 'todoapp' created and set as default
? Select an Azure Subscription to use:  1. shirokuma (f80766c9-6be7-43f9-8369-d492efceff1e)
? Enter a value for the 'backendImage' infrastructure parameter: [? for help] backend
? Enter a value for the 'backendImage' infrastructure parameter: backend
? Enter a value for the 'envName' infrastructure parameter: learn
? Enter a value for the 'frontendImage' infrastructure parameter: frontend
? Pick a resource group to use: 1. Create a new resource group
? Enter a name for the new resource group: (rg-todoapp)

? Enter a name for the new resource group: rg-todoapp
```