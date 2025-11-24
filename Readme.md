<h1>Youtube Freemium</h1>

Build steps
```
> cmake -DVERSION=<VERSION>.
> make extension
...

```
> winget install --id=Ninja-build.Ninja -e

> cmake -S . -B build -G "Ninja" -DVERSION='<VERSION>'
> cmake --build build --target package_and_print
...

> drag zip from /out to extension tab OR load unpacked extension directly to the /src
