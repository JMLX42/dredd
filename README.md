# ANAPI (Assemblée Nationale API)

A RESTful API to fetch data from the French "Assemblée Nationale".

## Features

* List bills.
* Get the text for a specific bill.

## Install

* Install [VirtualBox 4.3+](https://www.virtualbox.org/wiki/Downloads).
* Install [Vagrant 1.7+](https://docs.vagrantup.com/v2/installation/).
* `git clone https://github.com/promethe42/anapi.git && cd anapi`
* `vagrant up local` (run as admin on Windows)
* Add `192.168.50.43 anapi.fr.test` to your hosts file.
* Go to [http://anapi.fr.test](http://anapi.fr.test) to test the platform.

## Building and running

All the following procedures are to be executed on the dev environment VM using SSH. To connect to the VM using SSH, use the `vagrant ssh local` command in the install directory.

The Web API should build and run when the install is done but also whenever you start the machine. You can also manually control the process as a service:

`service anapi-api-web stop` (or `start` or `restart`)

To debug the API, you can run it directly in your terminal and have the (error) logs:

`cd /vagrant/api && npm start`

## Admin

The admin interface is available at [http://anapi.fr.test](http://anapi.fr.test). You must sign in with the following credentials:

* e-mail: admin@anapi.fr.test
* password: admin

## API

### Listing bills

`/api/bill/list`

### Get a specific bill

`/api/bill/get/:legislature/:number`

## Licence

MIT
