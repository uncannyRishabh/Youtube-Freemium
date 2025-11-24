<h1>Youtube Freemium</h1>

Build steps

<h2>MacOS</h2>

```
> cmake -DVERSION=<VERSION>
> make extension
```

<h2>Windows</h2>

```
#pre-requisites
> winget install --id=Ninja-build.Ninja -e
...

> cmake -S . -B build -G "Ninja" -DVERSION='<VERSION>'
> cmake --build build --target package_and_print
```
> finally drag zip from /out to extension tab OR load unpacked extension directly to the /src
