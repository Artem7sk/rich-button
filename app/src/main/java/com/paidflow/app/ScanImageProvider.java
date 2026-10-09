package com.paidflow.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;

public final class ScanImageProvider extends ContentProvider {
    @Override public boolean onCreate(){return true;}

    private File captureFile(Uri uri)throws FileNotFoundException{
        List<String> parts=uri.getPathSegments();
        if(parts.size()!=2||!"scan".equals(parts.get(0))||!parts.get(1).matches("capture-[0-9]+\\.jpg"))throw new FileNotFoundException("Invalid scan image URI");
        File dir=new File(getContext().getCacheDir(),"scan");
        try{File root=dir.getCanonicalFile(),file=new File(dir,parts.get(1)).getCanonicalFile();if(!file.getParentFile().equals(root))throw new FileNotFoundException("Invalid scan image path");return file;}catch(IOException e){throw new FileNotFoundException("Invalid scan image path");}
    }

    @Override public String getType(Uri uri){return "image/jpeg";}
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
        if(!"w".equals(mode)&&!"rw".equals(mode)&&!"rwt".equals(mode))throw new FileNotFoundException("Unsupported access mode");
        return ParcelFileDescriptor.open(captureFile(uri),ParcelFileDescriptor.MODE_READ_WRITE|ParcelFileDescriptor.MODE_TRUNCATE);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] selectionArgs,String sortOrder)throws FileNotFoundException{
        File file=captureFile(uri);String[] columns=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;MatrixCursor cursor=new MatrixCursor(columns);
        Object[] values=new Object[columns.length];for(int i=0;i<columns.length;i++){if(OpenableColumns.DISPLAY_NAME.equals(columns[i]))values[i]=file.getName();else if(OpenableColumns.SIZE.equals(columns[i]))values[i]=file.length();}
        cursor.addRow(values);return cursor;
    }
    @Override public int delete(Uri uri,String selection,String[] selectionArgs){return 0;}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] selectionArgs){return 0;}
    @Override public Uri insert(Uri uri,ContentValues values){return null;}
}
