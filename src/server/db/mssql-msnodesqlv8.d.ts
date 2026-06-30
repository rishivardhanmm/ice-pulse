// The `mssql` package exposes a Windows-auth driver under this subpath but
// ships no type declaration for it. We load it dynamically and cast to the
// main `mssql` types, so declaring it as an untyped module is sufficient.
declare module 'mssql/msnodesqlv8';
