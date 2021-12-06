import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const moduleUploader = {
  namespaced: true,
  state: () => ({
    successCount: 0,
    dirUploadSupport: false
  }),
  mutations: {
    uploadSuccess(state) {
      state.successCount += 1
    },
    dirUploadSupport(state, support) {
      state.dirUploadSupport = support
    }
  }
}

export default new Vuex.Store({
  state: {
    storages: [],
    cs: {},
  },
  mutations: {
    storages(state, storages) {
      state.storages = storages
    },
    cs(state, cs) {
      state.cs = cs
    },
  },
  actions: {},
  modules: {
    uploader: moduleUploader
  }
})
