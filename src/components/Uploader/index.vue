<template>
  <div class="uploader">
    <div style="display: flex; justify-content: space-between">
      <h5>{{ title }}</h5>
      <file-upload style="visibility: hidden;"
        ref="upload"
        input-id="file-uploader"
        v-model="files"
        :custom-action="doUpload"
        :multiple="true"
        :directory="isDirectory"
        :thread="3"
        @input-file="inputFile">
      </file-upload>
    </div>
    <el-table
      :data="files"
      size="mini"
      :show-header="false"
      :empty-text="$t('uploader.no-tasks')"
      style="width: 100%; max-height: 600px; overflow-y: auto;"
    >
      <el-table-column prop="icon" width="50">
        <template slot-scope="scope">
          <i :class="`iconfont matter-icon ${type2icon(scope.row.type)}`"></i>
        </template>
      </el-table-column>
      <el-table-column prop="name">
        <template slot-scope="scope">
          <div>{{ scope.row.name }}</div>
          <el-progress :percentage="Number(scope.row.progress)" :stroke-width="3" :show-text="false"></el-progress>
          <div style="font-size: 12px">
            <span class="size">{{ fomatSize(scope.row.size) }}</span>
            <span class="speed">{{ fomatSize(scope.row.speed) }}/s</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="op" width="100">
        <template slot-scope="scope">
          <!-- todo 暂停和继续需要依赖分片上传，先不支持，后续迭代 -->
          <el-button v-show="scope.row.progress == 100" type="primary" size="mini" icon="el-icon-folder" circle plain @click="onFolderClick(scope.row.matter)"></el-button>
          <!-- <el-button v-show="scope.row.progress != 100 && uploading" type="primary" size="mini" icon="el-icon-video-pause" circle plain @click="$refs.upload.active = false"></el-button> -->
          <!-- <el-button v-show="scope.row.progress != 100 && !uploading" type="primary" size="mini" icon="el-icon-video-play" circle plain @click="$refs.upload.active = true"></el-button> -->
          <el-button v-show="scope.row.progress != 100" type="primary" size="mini" icon="el-icon-close" circle plain @click="$refs.upload.remove(scope.row)"></el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="tip">- {{ $t("uploader.upload-hint") }} -</div>
  </div>
</template>

<script>
import FileUpload from "vue-upload-component";
import utils from "@/libs/utils";
export default {
  components: {
    FileUpload,
  },
  data() {
    return {
      sid: 0,
      dist: "",
      files: [],
      isDirectory: false,
    };
  },
  computed: {
    title() {
      const uploadedCnt = this.$store.state.uploader.successCount;
      const text = (this.$refs.upload && this.$refs.upload.uploaded)
        ? this.$t("uploader.upload-in-progress")
        : this.$t("uploader.upload-done");
      return `${text}（${uploadedCnt}/${this.files.length}）`;
    }
  },
  methods: {
    type2icon(type) {
      let [t1, t2] = type.split("/");
      let mt = ["pdf", "html", "xml", "psd", "rtf"];
      if (mt.includes(t2)) {
        return `icon-${t2}`;
      }

      let codeTypes = ["json", "yaml", "x-yaml"];
      if (codeTypes.includes(t2)) {
        return "icon-html";
      }

      let compressedFileTypes = ["zip", "x-gzip"];
      if (compressedFileTypes.includes(t2)) {
        return "icon-compressed-file";
      }

      // if (this.isOfficeFile(type)) {
      //   return this.officeIcon(type);
      // }

      let gt = ["audio", "video", "image", "text"];
      if (gt.includes(t1)) {
        return `icon-${t1}`;
      }

      return "icon-file";
    },
    fomatSize(v) {
      return utils.formatBytes(v, 1);
    },
    onFolderClick(matter) {
      this.$router.push({ name: "disk", params: this.$route.params, query: { dir: matter.parent } });
    },
    uploadSelect(obj) {
      this.sid = obj.sid;
      this.dist = obj.dist;
      this.isDirectory = obj.type === "folder";
      setTimeout(() => document.getElementById("file-uploader").click())
    },
    doUpload(file) {
      const updateFile = state => this.$refs.upload.update(file, state)
      return this.$zpan.File.create(this.sid, this.dist, file, updateFile)
        .then(() => updateFile({
            progress: "100.00",
            success: true
        }) || Promise.reject(new Error("update file error")))
    },
    inputFile(newFile, oldFile) {
      if (!newFile || !oldFile) {
        this.$emit("utotal-change", this.files.length);
      }
      if (Boolean(newFile) !== Boolean(oldFile) || oldFile.error !== newFile.error) {
        if (!this.$refs.upload.active) {
          this.$emit("upload-added");
          this.$refs.upload.active = true
        }
      }
      if (newFile && oldFile && !newFile.active && oldFile.active) {
        if (newFile.success) {
          this.$store.commit("uploader/uploadSuccess")
        }
      }
    },
  },
  mounted () {
    this.$store.commit("uploader/dirUploadSupport", this.$refs.upload.features.directory)
  }
};
</script>

<style lang="stylus">
.uploader
  .size
    color: #878c9c;

  .speed
    color: #06a7ff;
    float: right;

  .tip
    color: #afb3bf;
    margin-top: 10px;
    text-align: center;

  .matter-icon
    font-size: 35px;
    padding-left: 5px;
</style>
