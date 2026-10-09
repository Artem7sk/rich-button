package com.paidflow.app;

import android.content.ContentResolver;
import android.content.pm.ProviderInfo;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class ScanImageProviderTest {
    private ContentResolver resolver;
    private Uri uri;
    private File file;
    @Before public void setUp() {
        ProviderInfo info=new ProviderInfo();
        info.authority="com.paidflow.app.fileprovider";
        info.grantUriPermissions=true;
        Robolectric.buildContentProvider(ScanImageProvider.class).create(info);
        resolver=RuntimeEnvironment.getApplication().getContentResolver();
        File dir=new File(RuntimeEnvironment.getApplication().getCacheDir(),"scan");
        assertTrue(dir.isDirectory()||dir.mkdirs());
        file=new File(dir,"capture-123.jpg");
        uri=Uri.parse("content://"+info.authority+"/scan/"+file.getName());
    }
    @Test public void cameraOutputCanBeReadByOcrWithoutLosingBytes() throws Exception {
        byte[] photo="camera photo bytes".getBytes(StandardCharsets.UTF_8);
        // Same boundary as ACTION_IMAGE_CAPTURE -> copyScanImage/openInputStream.
        try(OutputStream out=resolver.openOutputStream(uri,"w")){out.write(photo);}
        try(InputStream in=resolver.openInputStream(uri)){assertArrayEquals(photo,in.readAllBytes());}
        assertEquals(photo.length,file.length());
        try(InputStream in=resolver.openInputStream(uri)){assertArrayEquals(photo,in.readAllBytes());}
    }
    @Test public void readWriteReopenDoesNotEraseCameraPhoto() throws Exception {
        try(OutputStream out=resolver.openOutputStream(uri,"w")){out.write(new byte[]{1,2,3,4});}
        try(ParcelFileDescriptor descriptor=resolver.openFileDescriptor(uri,"rw")){assertNotNull(descriptor);assertEquals(4,file.length());}
        try(InputStream in=resolver.openInputStream(uri)){assertArrayEquals(new byte[]{1,2,3,4},in.readAllBytes());}
    }
    @Test public void missingReadDoesNotCreateEmptyImage() throws Exception {
        assertFalse(file.exists());
        assertThrows(FileNotFoundException.class,()->resolver.openInputStream(uri));
        assertFalse(file.exists());
    }
    @Test public void arbitraryPathsAreRejected() {
        assertThrows(FileNotFoundException.class,()->resolver.openInputStream(Uri.parse("content://com.paidflow.app.fileprovider/scan/other.jpg")));
        assertThrows(FileNotFoundException.class,()->resolver.openInputStream(Uri.parse("content://com.paidflow.app.fileprovider/scan/../paidflow-v1.json")));
    }
}
