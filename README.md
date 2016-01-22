# Dredd - "I am the Law!"

A RESTful API to fetch data from the French "Assemblée Nationale".

## Features

* List bills.
* Get the text for a specific bill.
* Pretty bill texts available in Markdown and HTML.

## Install

* Install [VirtualBox 4.3+](https://www.virtualbox.org/wiki/Downloads).
* Install [Vagrant 1.8.1+](https://docs.vagrantup.com/v2/installation/).
* `git clone https://github.com/promethe42/dredd.git && cd dredd`
* `vagrant up local` (run as admin on Windows)
* Add `192.168.50.43 dredd.fr.test` to your hosts file.
* Go to [http://dredd.fr.test](http://dredd.fr.test) to test the platform.

## Upgrade

In the project root directory:

* Shutdown the VM: `vagrant halt local`.
* Update the code: `git pull`.
* Restart the VM and provision it: `vagrant up --provision`.

## Building and running

All the following procedures are to be executed on the dev environment VM using SSH. To connect to the VM using SSH, use the `vagrant ssh local` command in the install directory.

The Web API should build and run when the install is done but also whenever you start the machine. You can also manually control the process as a service:

`service dredd-api-web stop` (or `start` or `restart`)

To debug the API, you can run it directly in your terminal and have the (error) logs:

`cd /vagrant/api && npm start`

## Admin

The admin interface is available at [http://dredd.fr.test/keystone](http://dredd.fr.test/keystone). You must sign in with the following credentials:

* e-mail: `admin@dredd.fr.test`
* password: `admin`

## API

### Listing bills

#### URI

`/api/bill/list`

#### Parameters

None.

#### Examples

`/api/bill/list`

### Get a specific bill

#### URI

`/api/bill/:legislature/:number`

#### Parameters

* `:legislature`, the number of the legislature of the bill
* `:number`, the number of the bill
* `format`, the expected format of the bill text (`md` or `html`)

#### Examples

`/api/bill/14/3378`

`/api/bill/14/3393?format=md`

`/api/bill/14/3128?format=html`

### Search for bills

#### URI

`/api/bill/search`

#### Parameters

* `query`, a text query to match
* `before`, fetch only the bills that were registered before this date (formatted as YYYY-MM-DD)
* `after`,  fetch only the bills that were registered after this date (formatted as YYYY-MM-DD)
* `importedBefore`, fetch only the bills that were imported before this date (formatted as YYYY-MM-DD)
* `importedAfter`,  fetch only the bills that were imported after this date (formatted as YYYY-MM-DD)

#### Examples

`/api/bill/search?query=numérique`

`/api/bill/search?query=travail&before=2014-04-15`

## Licence

MIT
